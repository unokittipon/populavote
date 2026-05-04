import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

/**
 * Generates a PromptPay QR data URL for a given amount.
 * Note: PromptPay QR doesn't support a free-text "memo/reference" field that's
 * universally honored, so we use the reference number on-screen for the user
 * to compare against the slip — the slip's transRef is what we actually verify.
 */
export async function generatePromptPayQR(
  promptpayId: string,
  amount: number
): Promise<string> {
  const payload = generatePayload(promptpayId, { amount });
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#0a0a0a", light: "#fafaf7" }
  });
}

/** Short, URL-safe reference like "PV-K3X9-7Q2M". */
export function generateReferenceNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `PV-${block(4)}-${block(4)}`;
}
