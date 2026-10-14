import { constants, createPrivateKey, sign } from "node:crypto";
import type { OrderPreviewRequest, TerminalFill, TerminalOrder, TerminalPosition, TradingSide } from "./trading-types";

export const KALSHI_ORIGIN = "https://external-api.kalshi.com";
export const KALSHI_PATH = "/trade-api/v2";
export type ExchangeObject = Record<string, unknown>;
export interface KalshiCredentials { keyId: string; privateKeyPem: string }

export class KalshiRequestError extends Error {
  status: number | null;
  uncertain: boolean;
  constructor(status: number | null, uncertain: boolean) {
    super(status === 401 || status === 403 ? "Kalshi rejected the account credentials or permissions." : "Kalshi could not confirm this request.");
    this.name = "KalshiRequestError";
    this.status = status;
    this.uncertain = uncertain;
  }
}

export function asObject(value: unknown): ExchangeObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as ExchangeObject : {};
}
export function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value))) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function quantity(value: unknown) { const number = finiteNumber(value); return number !== null && number >= 0 ? number : null; }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function price(value: unknown) { const number = finiteNumber(value); return number !== null && number >= 0 && number <= 1 ? number : null; }
function sideOf(row: ExchangeObject): TradingSide | null {
  if (row.outcome_side === "yes" || row.outcome_side === "no") return row.outcome_side;
  if (row.book_side === "bid") return "yes";
  if (row.book_side === "ask") return "no";
  // Legacy sell-NO and buy-YES have the same directional exposure.
  if (row.side === "yes" || row.side === "no") return row.action === "sell" ? row.side === "yes" ? "no" : "yes" : row.side;
  return null;
}
function timestamp(value: unknown): string | null {
  const result = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(result) ? new Date(result).toISOString() : null;
}
function outcomePrice(row: ExchangeObject, side: TradingSide | null) {
  if (!side) return null;
  return price(row[`${side}_price_dollars`]);
}

export function normalizeOrder(value: unknown): TerminalOrder | null {
  const row = asObject(value);
  const id = text(row.order_id), ticker = text(row.ticker);
  if (!id || !ticker) return null;
  const side = sideOf(row);
  return { id, ticker, side, clientOrderId: text(row.client_order_id) || null,
    status: text(row.status) || "unknown", limitPrice: outcomePrice(row, side),
    count: quantity(row.initial_count_fp), filledCount: quantity(row.fill_count_fp),
    remainingCount: quantity(row.remaining_count_fp), createdAt: timestamp(row.created_time) };
}
export function normalizeFill(value: unknown): TerminalFill | null {
  const row = asObject(value), side = sideOf(row);
  const id = text(row.fill_id) || text(row.trade_id), orderId = text(row.order_id), ticker = text(row.ticker) || text(row.market_ticker);
  if (!id || !orderId || !ticker) return null;
  return { id, orderId, ticker, side, price: outcomePrice(row, side), count: quantity(row.count_fp),
    feeDollars: quantity(row.fee_cost), createdAt: timestamp(row.created_time) };
}
export function normalizePosition(value: unknown): TerminalPosition | null {
  const row = asObject(value), ticker = text(row.ticker), position = finiteNumber(row.position_fp);
  if (!ticker) return null;
  return { ticker, side: position === null || position === 0 ? null : position > 0 ? "yes" : "no",
    count: position === null ? null : Math.abs(position), marketExposureDollars: finiteNumber(row.market_exposure_dollars),
    realizedPnlDollars: finiteNumber(row.realized_pnl_dollars), feesPaidDollars: quantity(row.fees_paid_dollars) };
}
export function normalizeBalance(row: ExchangeObject) {
  return { balanceDollars: quantity(row.balance_dollars) ?? (quantity(row.balance) === null ? null : Number(row.balance) / 100),
    portfolioValueDollars: quantity(row.portfolio_value) === null ? null : Number(row.portfolio_value) / 100 };
}

export function signKalshiRequest(credentials: KalshiCredentials, method: string, path: string, now = Date.now()) {
  const timestamp = String(now);
  const message = Buffer.from(timestamp + method.toUpperCase() + path.split("?")[0]);
  const key = createPrivateKey(credentials.privateKeyPem);
  if (key.asymmetricKeyType !== "rsa" && key.asymmetricKeyType !== "rsa-pss" && key.asymmetricKeyType !== "ed25519") throw new Error("Unsupported Kalshi private key algorithm.");
  const signature = key.asymmetricKeyType === "ed25519"
    ? sign(null, message, key)
    : sign("sha256", message, { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_DIGEST });
  return { "KALSHI-ACCESS-KEY": credentials.keyId, "KALSHI-ACCESS-TIMESTAMP": timestamp, "KALSHI-ACCESS-SIGNATURE": signature.toString("base64") };
}

export function createKalshiClient(credentials: KalshiCredentials, fetcher: typeof fetch = fetch) {
  return {
    async request(path: string, method: "GET" | "POST" | "DELETE" = "GET", body?: unknown): Promise<ExchangeObject> {
      if (!path.startsWith("/") || path.includes("://") || path.startsWith("//")) throw new Error("Invalid exchange path.");
      const fullPath = KALSHI_PATH + path;
      const headers = { ...signKalshiRequest(credentials, method, fullPath), "Content-Type": "application/json", Accept: "application/json" };
      let response: Response;
      try {
        response = await fetcher(KALSHI_ORIGIN + fullPath, { method, headers, body: body === undefined ? undefined : JSON.stringify(body),
          cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
      } catch { throw new KalshiRequestError(null, method !== "GET"); }
      if (!response.ok) {
        // A timeout, duplicate ID or upstream 5xx may follow an accepted write.
        const uncertain = method !== "GET" && (response.status === 408 || response.status === 409 || response.status >= 500);
        throw new KalshiRequestError(response.status, uncertain);
      }
      try { return asObject(await response.json()); }
      catch { throw new KalshiRequestError(response.status, method !== "GET"); }
    },
  };
}
export type KalshiClient = ReturnType<typeof createKalshiClient>;

export function toKalshiOrder(input: OrderPreviewRequest, clientOrderId: string) {
  const selectedPrice = Math.round(input.limitPrice * 10_000);
  return { ticker: input.ticker, client_order_id: clientOrderId, side: input.side === "yes" ? "bid" : "ask",
    count: input.count.toFixed(2), price: ((input.side === "yes" ? selectedPrice : 10_000 - selectedPrice) / 10_000).toFixed(4),
    time_in_force: "good_till_canceled", self_trade_prevention_type: "taker_at_cross", cancel_order_on_pause: true,
    subaccount: 0, exchange_index: -1 };
}

export async function readPages(client: KalshiClient, path: string, field: string, maxPages = 5) {
  const rows: unknown[] = [];
  let cursor = "";
  for (let page = 0; page < maxPages; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const result = await client.request(`${path}${separator}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!Array.isArray(result[field])) throw new KalshiRequestError(502, false);
    rows.push(...result[field]);
    const next = text(result.cursor);
    if (!next) return { rows, partial: false };
    if (next === cursor) return { rows, partial: true };
    cursor = next;
  }
  return { rows, partial: true };
}

export async function findOrderByClientId(client: KalshiClient, ticker: string, clientOrderId: string): Promise<TerminalOrder | null> {
  const { rows } = await readPages(client, `/portfolio/orders?subaccount=0&ticker=${encodeURIComponent(ticker)}`, "orders", 10);
  for (const row of rows) {
    const normalized = normalizeOrder(row);
    if (normalized?.clientOrderId === clientOrderId) return normalized;
  }
  return null;
}
