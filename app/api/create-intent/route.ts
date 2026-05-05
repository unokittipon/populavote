import { NextRequest, NextResponse } from "next/server";
import { generatePromptPayQR, generateReferenceNumber } from "@/lib/promptpay";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { serverClient, isVotingOpen } from "@/lib/supabase";  // add isVotingOpen here

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Rate limit: 10 intents per minute per IP
  
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`intent:${ip}`, 200, 60_000);
  
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s` },
      { status: 429 }
    );
  }
  
  if (!(await isVotingOpen())) {
  return NextResponse.json({ error: "Voting is currently closed" }, { status: 403 });
  }

  serverClient().rpc("expire_stale_intents").then(() => {}, () => {});

  try {
    const body = await req.json();
    const candidateId = String(body.candidateId || "");
    const amount = Number(body.amount);

    // Validate
    if (!candidateId) {
      return NextResponse.json({ error: "candidateId required" }, { status: 400 });
    }
    if (!Number.isInteger(amount) || amount < 10 || amount > 100000) {
      return NextResponse.json(
        { error: "Amount must be a multiple of 10, between 10 and 100,000" },
        { status: 400 }
      );
    }
    if (amount % 10 !== 0) {
      return NextResponse.json({ error: "Amount must be a multiple of 10" }, { status: 400 });
    }

    const promptpayId = process.env.PROMPTPAY_ID;
    if (!promptpayId) {
      return NextResponse.json({ error: "PromptPay not configured" }, { status: 500 });
    }

    const sb = serverClient();

    // Verify candidate exists
    const { data: cand } = await sb
      .from("candidates")
      .select("id")
      .eq("id", candidateId)
      .single();
    if (!cand) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Create intent
    const reference = generateReferenceNumber();
    const { data: intent, error } = await sb
      .from("payment_intents")
      .insert({
        candidate_id: candidateId,
        amount_baht: amount,
        reference_number: reference,
        status: "pending"
      })
      .select("id, reference_number")
      .single();

    if (error || !intent) {
      console.error("Intent insert error:", error);
      return NextResponse.json({ error: "Could not create intent" }, { status: 500 });
    }

    const qr = await generatePromptPayQR(promptpayId, amount);

    return NextResponse.json({
      id: intent.id,
      reference: intent.reference_number,
      qr
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
