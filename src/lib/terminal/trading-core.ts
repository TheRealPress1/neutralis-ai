import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { OrderPreview, OrderPreviewRequest } from "./trading-types";

export const PREVIEW_LIFETIME_MS = 60_000;
export const MAX_ORDER_CONTRACTS = 1_000;
export const MAX_ORDER_NOTIONAL = 1_000;
export class TradingError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) { super(message); this.name = "TradingError"; this.code = code; this.status = status; }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TradingError("invalid_request", "A JSON object is required.");
  return value as Record<string, unknown>;
}
export function validateOrderInput(value: unknown): OrderPreviewRequest {
  const input = object(value);
  if (Object.keys(input).some((key) => !["ticker", "side", "count", "limitPrice"].includes(key))) throw new TradingError("invalid_request", "Unsupported order fields.");
  if (typeof input.ticker !== "string" || !/^[A-Z0-9][A-Z0-9.-]{0,119}$/.test(input.ticker)) throw new TradingError("invalid_ticker", "Use the exact Kalshi market ticker.");
  if (input.side !== "yes" && input.side !== "no") throw new TradingError("invalid_side", "Choose YES or NO.");
  if (typeof input.count !== "number" || !Number.isSafeInteger(input.count) || input.count < 1 || input.count > MAX_ORDER_CONTRACTS) throw new TradingError("invalid_count", `Enter 1–${MAX_ORDER_CONTRACTS} whole contracts.`);
  if (typeof input.limitPrice !== "number" || !Number.isFinite(input.limitPrice) || input.limitPrice < 0.0001 || input.limitPrice > 0.9999 || Math.abs(input.limitPrice * 10_000 - Math.round(input.limitPrice * 10_000)) > 1e-7) throw new TradingError("invalid_price", "Enter a finite limit between $0.0001 and $0.9999, with at most four decimal places.");
  if (input.count * input.limitPrice > MAX_ORDER_NOTIONAL) throw new TradingError("order_limit", `This terminal limits each order to $${MAX_ORDER_NOTIONAL} before fees.`);
  return { ticker: input.ticker, side: input.side, count: input.count, limitPrice: input.limitPrice };
}
function fixedUnits(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,4})?$/.test(value)) return null;
  return Math.round(Number(value) * 10_000);
}
export function validateMarketForOrder(input: OrderPreviewRequest, value: unknown, now = Date.now()) {
  const market = object(value);
  if (market.ticker !== input.ticker) throw new TradingError("market_mismatch", "The exchange returned a different contract.", 502);
  if (market.market_type !== "binary" || market.status !== "active" || market.result) throw new TradingError("market_closed", "This market is not accepting binary event orders.");
  const closeTime = typeof market.close_time === "string" ? Date.parse(market.close_time) : NaN;
  const openTime = typeof market.open_time === "string" ? Date.parse(market.open_time) : NaN;
  if (!Number.isFinite(closeTime) || closeTime <= now || !Number.isFinite(openTime) || openTime > now) throw new TradingError("market_closed", "This market is outside its trading window.");
  if (market.notional_value_dollars !== "1.0000" && market.notional_value_dollars !== "1.00" && market.notional_value_dollars !== "1") throw new TradingError("unsupported_contract", "Only standard $1 binary event contracts are supported.");
  if (market.mve_collection_ticker || market.mve_selected_legs) throw new TradingError("unsupported_contract", "Combo contracts are not supported in this terminal.");
  const ranges = Array.isArray(market.price_ranges) ? market.price_ranges : [];
  const limit = Math.round(input.limitPrice * 10_000);
  const yesPrice = input.side === "yes" ? limit : 10_000 - limit;
  const onGrid = ranges.some((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const range = value as Record<string, unknown>;
    const start = fixedUnits(range.start), end = fixedUnits(range.end), step = fixedUnits(range.step);
    return start !== null && end !== null && step !== null && step > 0 && yesPrice >= start && yesPrice <= end && (yesPrice - start) % step === 0;
  });
  if (!onGrid) throw new TradingError("invalid_price_grid", "This price is outside the market's current price increments. Refresh and review a valid limit.");
}

export function estimateFees(input: OrderPreviewRequest, feeType: unknown, multiplier: unknown) {
  if (feeType !== "quadratic" && feeType !== "quadratic_with_maker_fees") throw new TradingError("unsupported_fees", "This contract's fee schedule is not supported. Trade it directly on Kalshi.");
  if (typeof multiplier !== "number" || !Number.isFinite(multiplier) || multiplier < 0 || multiplier > 10) throw new TradingError("unsupported_fees", "A current, supported fee multiplier is required.");
  const p = input.limitPrice;
  const estimatedFeeDollars = Math.ceil((0.07 * multiplier * input.count * p * (1 - p) + Number.EPSILON) * 100) / 100;
  // Price improvement can increase P(1-P); reserve using its peak over allowed buy prices.
  const peak = Math.min(p, 0.5);
  const reserve = Math.ceil((0.07 * multiplier * input.count * peak * (1 - peak) + input.count * 0.01) * 100) / 100;
  const notionalDollars = Math.round(input.count * p * 10_000) / 10_000;
  return { notionalDollars, estimatedFeeDollars: multiplier === 0 ? 0 : estimatedFeeDollars,
    maxCostDollars: Math.ceil((notionalDollars + reserve) * 100) / 100,
    feeDescription: `Estimated taker fee uses Kalshi's current ${feeType} schedule (${multiplier}×). Estimated total reserves fees at any permitted fill price plus 1¢ per contract for rounding. Actual fees depend on fills and future fee changes; this is not an exchange-enforced fee cap.` };
}

interface PreviewPayload {
  version: 1;
  userId: string;
  credentialBinding: string;
  issuedAt: number;
  preview: OrderPreview;
}
export function credentialBinding(keyId: string, secret: Buffer) {
  return createHmac("sha256", secret).update("kalshi-key:" + keyId).digest("hex");
}
export function issuePreview(preview: Omit<OrderPreview, "clientOrderId" | "expiresAt">, userId: string, keyId: string, secret: Buffer, now = Date.now()) {
  const completed: OrderPreview = { ...preview, clientOrderId: randomUUID(), expiresAt: new Date(now + PREVIEW_LIFETIME_MS).toISOString() };
  const payload: PreviewPayload = { version: 1, userId, credentialBinding: credentialBinding(keyId, secret), issuedAt: now, preview: completed };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return { preview: completed, previewToken: `${encoded}.${signature}` };
}
export function verifyPreview(token: unknown, userId: string, keyId: string, secret: Buffer, now = Date.now(), allowExpired = false): PreviewPayload {
  if (typeof token !== "string" || token.length > 8_000) throw new TradingError("invalid_preview", "Review a fresh order before submitting.");
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new TradingError("invalid_preview", "The order review is invalid.");
  const actual = Buffer.from(signature, "base64url"), expected = createHmac("sha256", secret).update(encoded).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new TradingError("invalid_preview", "The order review has been changed. Review it again.");
  let payload: PreviewPayload;
  try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); } catch { throw new TradingError("invalid_preview", "The order review is invalid."); }
  if (!payload || payload.version !== 1 || payload.userId !== userId || payload.credentialBinding !== credentialBinding(keyId, secret) || !payload.preview) throw new TradingError("invalid_preview", "This order review does not belong to this connected account.", 403);
  validateOrderInput({ ticker: payload.preview.ticker, side: payload.preview.side, count: payload.preview.count, limitPrice: payload.preview.limitPrice });
  const expires = Date.parse(payload.preview.expiresAt);
  if (!Number.isFinite(expires) || !Number.isFinite(payload.issuedAt) || expires - payload.issuedAt !== PREVIEW_LIFETIME_MS || payload.issuedAt > now + 5_000 || !/^[0-9a-f-]{36}$/.test(payload.preview.clientOrderId)) throw new TradingError("invalid_preview", "The order review is invalid.");
  if (!allowExpired && expires <= now) throw new TradingError("preview_expired", "This order review expired. Refresh and review the order again.", 409);
  return payload;
}
export function previewHash(token: string) { return createHash("sha256").update(token).digest("hex"); }

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new TradingError("invalid_origin", "This request must originate from this application.", 403);
}
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) throw new TradingError("invalid_content_type", "Send JSON with this request.", 415);
  if (Number(request.headers.get("content-length")) > 8_192) throw new TradingError("request_too_large", "The request is too large.", 413);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 8_192) {
          await reader.cancel();
          throw new TradingError("request_too_large", "The request is too large.", 413);
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return object(JSON.parse(raw)); } catch (error) {
    if (error instanceof TradingError) throw error;
    throw new TradingError("invalid_json", "The request must contain valid JSON.");
  }
}
