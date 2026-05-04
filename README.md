# Populavote — PromptPay Voting Web App

A vote-with-payment web app for school/club events. Users pay via PromptPay QR (10฿ = 1 vote point) and votes are awarded after slip verification.

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (Postgres) + SlipOK API

---

## 1. Setup accounts

1. **Supabase** — https://supabase.com → create project (free tier). Save the URL and `service_role` key.
2. **SlipOK** — https://slipok.com → create branch, get API key + branch ID. Free tier ~100 slips/month.
3. **PromptPay** — your phone-number-linked bank account.
4. **Vercel** — https://vercel.com (for deploy later).

## 2. Local install

```bash
npm install
cp .env.example .env.local   # fill in real values
```

## 3. Database setup

Open Supabase → SQL Editor → paste and run `supabase/schema.sql`.
Then run `supabase/functions.sql`.

## 4. Add candidates

Either:
- Use Supabase Table Editor → `candidates` → insert rows manually
- Or visit `/admin` route after setting `ADMIN_TOKEN` in env (then go to `/admin?token=YOUR_TOKEN`)

## 5. Run dev

```bash
npm run dev
```

Open http://localhost:3000

## 6. Deploy

```bash
git init && git add . && git commit -m "init"
# push to GitHub
# import into Vercel, paste env vars
```

---

## Security notes (READ THIS)

- `SUPABASE_SERVICE_ROLE_KEY` must NEVER be prefixed with `NEXT_PUBLIC_`. It bypasses RLS.
- Slip verification happens server-side only. Never trust the browser.
- Each slip's `transRef` is stored in DB with a unique constraint — cannot be reused.
- Amount and recipient PromptPay ID are checked against the payment_intent the user started with.
- Reference numbers in QR memo prevent ambiguity if two users pay the same amount.

## Known limits / things to add later

- No auth on voters (school events don't need it; public voting would).
- No rate limiting (add Vercel rate limit or Upstash for production).
- `/admin` uses a simple token — fine for school, use real auth for production.
- Slip image stored only briefly during verify — not persisted (saves storage).

## Files map

```
app/
  page.tsx                  → home (candidate list)
  vote/[id]/page.tsx        → vote page for a candidate
  results/page.tsx          → live leaderboard
  admin/page.tsx            → add/edit candidates
  api/create-intent/route.ts → create payment intent + QR
  api/verify-slip/route.ts   → verify slip via SlipOK, award votes
lib/
  supabase.ts               → server + browser clients
  promptpay.ts              → QR generation
components/
  CandidateCard.tsx
  VoteFlow.tsx              → QR display + slip upload
  Leaderboard.tsx
supabase/
  schema.sql                → tables, view
  functions.sql             → atomic vote function
```
