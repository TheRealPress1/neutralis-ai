import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { rateLimit } from "@/lib/rate-limit";
import type { Database } from "@/lib/supabase/types";
import { asObject, createKalshiClient, findOrderByClientId, finiteNumber, KalshiRequestError, normalizeBalance, normalizeFill, normalizeOrder, normalizePosition, readPages, toKalshiOrder, type KalshiClient } from "./kalshi";
import { credentialBinding, estimateFees, issuePreview, previewHash, TradingError, validateMarketForOrder, validateOrderInput, verifyPreview } from "./trading-core";
import { executeOnce } from "./trading-execution";
import type { OrderCancelResponse, OrderPreview, OrderPreviewResponse, OrderSubmitResponse, TerminalAccount, TerminalOrder } from "./trading-types";

type SessionClient = Awaited<ReturnType<typeof createClient>>;
type Submission = Database["public"]["Tables"]["terminal_order_submissions"]["Row"];
interface TradingContext { userId: string; supabase: SessionClient; keyId: string | null; client: KalshiClient | null; connectionError: string | null }

function previewSecret(): Buffer {
  const key = process.env.KALSHI_ORDER_PREVIEW_SECRET;
  if (!key || !/^[a-f\d]{64}$/i.test(key)) throw new TradingError("trading_not_configured", "Order review signing is not configured on this server.", 503);
  return Buffer.from(key, "hex");
}
function readiness(): string | null {
  if (process.env.KALSHI_MANUAL_TRADING_ENABLED !== "true") return "Manual trading is not enabled on this deployment. Account data and order reviews remain available.";
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return "The durable order submission ledger is not configured.";
  try { previewSecret(); } catch { return "Order review signing is not configured."; }
  return null;
}
function ledgerWriter() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new TradingError("trading_not_configured", "The durable order submission ledger is not configured.", 503);
  return createSupabaseClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function tradingContext(mutation = false): Promise<TradingContext> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new TradingError("not_authenticated", "Sign in to connect your Kalshi account.", 401);
  if (!rateLimit(`terminal:${mutation ? "write" : "read"}:${user.id}`, { limit: mutation ? 20 : 90, windowMs: 60_000 }).success) throw new TradingError("rate_limited", "Too many requests. Wait a moment before trying again.", 429);
  const { data, error: keyError } = await supabase.from("user_api_keys").select("api_key_id, private_key_pem, is_valid")
    .eq("user_id", user.id).eq("platform", "kalshi").maybeSingle();
  if (keyError) throw new TradingError("connection_unavailable", "Connected exchange settings could not be loaded.", 503);
  if (!data) return { userId: user.id, supabase, keyId: null, client: null, connectionError: null };
  if (!data.is_valid || !data.api_key_id || !data.private_key_pem) return { userId: user.id, supabase, keyId: null, client: null, connectionError: "Reconnect and validate your Kalshi API key in account settings." };
  try {
    // No legacy plaintext fallback. Only this user's authenticated, encrypted key row is used.
    const privateKeyPem = decrypt(data.private_key_pem);
    return { userId: user.id, supabase, keyId: data.api_key_id, client: createKalshiClient({ keyId: data.api_key_id, privateKeyPem }), connectionError: null };
  } catch { return { userId: user.id, supabase, keyId: null, client: null, connectionError: "The connected Kalshi key cannot be decrypted. Reconnect your account." }; }
}
function connected(context: TradingContext): { client: KalshiClient; keyId: string } {
  if (!context.client || !context.keyId) throw new TradingError("not_connected", context.connectionError ?? "Connect your Kalshi account before reviewing an order.", 409);
  return { client: context.client, keyId: context.keyId };
}
function requireTradingEnabled() {
  const reason = readiness();
  if (reason) throw new TradingError("trading_disabled", reason, 503);
}
async function readSubmission(context: TradingContext, clientOrderId: string) {
  const { data, error } = await context.supabase.from("terminal_order_submissions").select("*")
    .eq("user_id", context.userId).eq("client_order_id", clientOrderId).returns<Submission[]>().maybeSingle();
  if (error) throw new TradingError("ledger_unavailable", "The order ledger is unavailable. No new order can be submitted.", 503);
  return data;
}
async function readPending(context: TradingContext) {
  const { data, error } = await context.supabase.from("terminal_order_submissions").select("*")
    .eq("user_id", context.userId).in("status", ["submitting", "unknown"]).returns<Submission[]>().maybeSingle();
  return { data, error };
}
async function updateSubmission(context: TradingContext, id: string, status: Submission["status"], orderId?: string) {
  try {
    const { error } = await ledgerWriter().from("terminal_order_submissions")
      .update({ status, ...(orderId ? { order_id: orderId } : {}), updated_at: new Date().toISOString() })
      .eq("user_id", context.userId).eq("client_order_id", id);
    return !error;
  } catch { return false; }
}
function matchesSubmissionAccount(context: TradingContext, row: Submission) {
  try { return !!context.keyId && row.credential_binding === credentialBinding(context.keyId, previewSecret()); }
  catch { return false; }
}

export async function getTradingAccount(context: TradingContext): Promise<TerminalAccount> {
  const base: TerminalAccount = { connection: context.connectionError ? "unavailable" : "not_connected", tradingEnabled: false,
    reason: context.connectionError ?? "Connect Kalshi in account settings to view your real exchange account.", balanceDollars: null,
    portfolioValueDollars: null, orders: [], fills: [], positions: [], pendingSubmission: null, partial: false, fetchedAt: new Date().toISOString() };
  if (!context.client) return base;
  const client = context.client;
  const pending = await readPending(context);
  const pendingAccountMismatch = pending.data && !matchesSubmissionAccount(context, pending.data);
  const disabledReason = readiness() ?? (pending.error ? "The order ledger migration is required before trading can be enabled." : null);
  try {
    const [balance, resting, recentOrders, fills, positions] = await Promise.all([
      client.request("/portfolio/balance?subaccount=0"),
      readPages(client, "/portfolio/orders?subaccount=0&status=resting", "orders"),
      readPages(client, "/portfolio/orders?subaccount=0", "orders", 1),
      readPages(client, "/portfolio/fills?subaccount=0", "fills", 1),
      readPages(client, "/portfolio/positions?subaccount=0&count_filter=position", "market_positions"),
    ]);
    const normalized = [...resting.rows, ...recentOrders.rows].map(normalizeOrder).filter((order) => order !== null);
    const orders = [...new Map(normalized.map((order) => [order.id, order])).values()];
    let pendingSubmission: TerminalAccount["pendingSubmission"] = pending.data ? { clientOrderId: pending.data.client_order_id, ticker: pending.data.ticker, status: pending.data.status as "submitting" | "unknown" } : null;
    if (pending.data && !pendingAccountMismatch) {
      let found = orders.find((order) => order.clientOrderId === pending.data!.client_order_id);
      if (!found) found = await findOrderByClientId(client, pending.data.ticker, pending.data.client_order_id) ?? undefined;
      if (found) {
        if (!orders.some((order) => order.id === found!.id)) orders.unshift(found);
        if (await updateSubmission(context, pending.data.client_order_id, "accepted", found.id)) pendingSubmission = null;
      }
    }
    return { ...base, ...normalizeBalance(balance), connection: "connected", tradingEnabled: !disabledReason,
      reason: pendingAccountMismatch ? "The unresolved order belongs to different connected credentials. Restore the original Kalshi connection and review-signing configuration to reconcile it."
        : pendingSubmission ? "A previous order needs exchange reconciliation before another can be submitted." : disabledReason,
      orders, fills: fills.rows.map(normalizeFill).filter((fill) => fill !== null),
      positions: positions.rows.map(normalizePosition).filter((position) => position !== null), pendingSubmission,
      partial: resting.partial || recentOrders.partial || fills.partial || positions.partial, fetchedAt: new Date().toISOString() };
  } catch (error) {
    return { ...base, connection: "unavailable", reason: error instanceof KalshiRequestError ? error.message : "The exchange account could not be reconciled. Try refreshing.",
      pendingSubmission: pending.data ? { clientOrderId: pending.data.client_order_id, ticker: pending.data.ticker, status: pending.data.status as "submitting" | "unknown" } : null };
  }
}

async function validateFreshOrder(client: KalshiClient, input: ReturnType<typeof validateOrderInput>) {
  const [marketResponse, exchange] = await Promise.all([client.request(`/markets/${encodeURIComponent(input.ticker)}`), client.request("/exchange/status")]);
  const market = asObject(marketResponse.market);
  validateMarketForOrder(input, market);
  if (exchange.trading_active !== true || exchange.exchange_active !== true) throw new TradingError("exchange_paused", "Kalshi trading is currently paused. No order was sent.", 409);
  if (typeof market.event_ticker !== "string") throw new TradingError("unsupported_fees", "The exchange did not provide current event metadata.", 503);
  const event = asObject((await client.request(`/events/${encodeURIComponent(market.event_ticker)}`)).event);
  if (event.event_ticker !== market.event_ticker || typeof event.series_ticker !== "string") throw new TradingError("unsupported_fees", "The event fee metadata could not be verified.", 503);
  const series = asObject((await client.request(`/series/${encodeURIComponent(event.series_ticker)}`)).series);
  if (series.ticker !== event.series_ticker) throw new TradingError("unsupported_fees", "The series fee metadata could not be verified.", 503);
  const hasOverride = event.fee_type_override !== null && event.fee_type_override !== undefined;
  if (hasOverride !== (event.fee_multiplier_override !== null && event.fee_multiplier_override !== undefined)) throw new TradingError("unsupported_fees", "The event fee override is incomplete.", 503);
  const fees = estimateFees(input, hasOverride ? event.fee_type_override : series.fee_type, hasOverride ? event.fee_multiplier_override : series.fee_multiplier);
  return { market, fees };
}

export async function previewTradingOrder(context: TradingContext, body: unknown): Promise<OrderPreviewResponse> {
  const { client, keyId } = connected(context);
  const secret = previewSecret();
  const input = validateOrderInput(body);
  const { data: pending, error: ledgerError } = await readPending(context);
  if (pending) throw new TradingError("pending_submission", "Reconcile the previous order before reviewing another.", 409);
  const { market, fees } = await validateFreshOrder(client, input);
  const balance = normalizeBalance(await client.request("/portfolio/balance?subaccount=0")).balanceDollars;
  if (balance === null) throw new TradingError("balance_unavailable", "Available account balance could not be verified.", 503);
  if (fees.maxCostDollars > balance) throw new TradingError("insufficient_balance", "Available Kalshi balance is below the order's estimated total including the fee reserve.", 409);
  return issuePreview({ ...input, question: typeof market.title === "string" ? market.title : input.ticker, action: "buy", timeInForce: "good_till_canceled",
    ...fees, tradingEnabled: !readiness() && !ledgerError }, context.userId, keyId, secret);
}

async function reconcileKnown(context: TradingContext, row: Submission): Promise<OrderSubmitResponse> {
  const client = connected(context).client;
  if (!matchesSubmissionAccount(context, row)) return { status: "unknown", order: null, clientOrderId: row.client_order_id,
    message: "Restore the original connected Kalshi credentials to reconcile this submission. No exchange write was sent." };
  if (row.status === "rejected") return { status: "rejected", order: null, clientOrderId: row.client_order_id, message: "This submission was rejected. No retry was sent." };
  try {
    const order = row.order_id ? normalizeOrder((await client.request(`/portfolio/orders/${encodeURIComponent(row.order_id)}`)).order) : await findOrderByClientId(client, row.ticker, row.client_order_id);
    if (order && order.clientOrderId === row.client_order_id) {
      await updateSubmission(context, row.client_order_id, "accepted", order.id);
      return { status: "accepted", order, clientOrderId: row.client_order_id, message: "Order confirmed directly with Kalshi." };
    }
  } catch { /* An unavailable read never proves that an exchange write failed. */ }
  if (row.status === "accepted") return { status: "accepted", order: null, clientOrderId: row.client_order_id, message: "Kalshi previously acknowledged this order. Refresh the account for its latest state." };
  return { status: "unknown", order: null, clientOrderId: row.client_order_id, message: "The exchange has not confirmed the outcome yet. Keep this order reference and check status; do not place it again." };
}

export async function reconcileTradingOrder(context: TradingContext, token: unknown): Promise<OrderSubmitResponse> {
  const { keyId } = connected(context);
  const { preview } = verifyPreview(token, context.userId, keyId, previewSecret(), Date.now(), true);
  const row = await readSubmission(context, preview.clientOrderId);
  if (row) {
    if (row.preview_hash !== previewHash(token as string)) throw new TradingError("invalid_preview", "This order review does not match the recorded submission.", 409);
    return reconcileKnown(context, row);
  }
  if (Date.parse(preview.expiresAt) > Date.now()) return { status: "unknown", order: null, clientOrderId: preview.clientOrderId, message: "No submission is recorded yet. Wait until this review expires, then check status again." };
  return { status: "rejected", order: null, clientOrderId: preview.clientOrderId, message: "The review expired without a recorded submission. No exchange order was sent." };
}

function acknowledgedOrder(response: Record<string, unknown>, preview: OrderPreview): TerminalOrder | null {
  const filled = finiteNumber(response.fill_count), remaining = finiteNumber(response.remaining_count);
  if (typeof response.order_id !== "string" || !response.order_id || (response.client_order_id && response.client_order_id !== preview.clientOrderId) || filled === null || remaining === null || filled < 0 || remaining < 0 || filled + remaining > preview.count) return null;
  const ts = finiteNumber(response.ts_ms);
  return { id: response.order_id, clientOrderId: preview.clientOrderId, ticker: preview.ticker, side: preview.side,
    status: remaining > 0 ? "resting" : filled >= preview.count ? "executed" : "canceled", limitPrice: preview.limitPrice,
    count: preview.count, filledCount: filled, remainingCount: remaining, createdAt: ts !== null && ts > 0 ? new Date(ts).toISOString() : null };
}

export async function submitTradingOrder(context: TradingContext, body: Record<string, unknown>): Promise<OrderSubmitResponse> {
  if (body.confirmed !== true || Object.keys(body).some((key) => !["previewToken", "confirmed"].includes(key))) throw new TradingError("confirmation_required", "Explicitly confirm the reviewed order before submitting.");
  const { client, keyId } = connected(context);
  const secret = previewSecret();
  const { preview } = verifyPreview(body.previewToken, context.userId, keyId, secret, Date.now(), true);
  const hash = previewHash(body.previewToken as string);
  const existing = await readSubmission(context, preview.clientOrderId);
  if (existing) {
    if (existing.preview_hash !== hash) throw new TradingError("invalid_preview", "The review does not match the recorded submission.", 409);
    return reconcileKnown(context, existing);
  }
  requireTradingEnabled();
  verifyPreview(body.previewToken, context.userId, keyId, secret);
  const input = validateOrderInput({ ticker: preview.ticker, side: preview.side, count: preview.count, limitPrice: preview.limitPrice });
  const { fees } = await validateFreshOrder(client, input);
  if (fees.estimatedFeeDollars !== preview.estimatedFeeDollars || fees.maxCostDollars !== preview.maxCostDollars || fees.feeDescription !== preview.feeDescription) throw new TradingError("fees_changed", "The fee schedule changed. Review the order again.", 409);
  const balance = normalizeBalance(await client.request("/portfolio/balance?subaccount=0")).balanceDollars;
  if (balance === null || balance < fees.maxCostDollars) throw new TradingError("insufficient_balance", "The exchange balance no longer covers the reviewed order.", 409);
  verifyPreview(body.previewToken, context.userId, keyId, secret);
  return executeOnce({
    preview,
    lookup: () => readSubmission(context, preview.clientOrderId),
    claim: async () => {
      const { error } = await ledgerWriter().from("terminal_order_submissions").insert({ client_order_id: preview.clientOrderId, user_id: context.userId,
        ticker: preview.ticker, status: "submitting", preview_hash: hash, credential_binding: credentialBinding(keyId, secret) });
      return !error;
    },
    save: (status, orderId) => updateSubmission(context, preview.clientOrderId, status, orderId),
    send: async () => {
      const response = await client.request("/portfolio/events/orders", "POST", toKalshiOrder(input, preview.clientOrderId));
      const order = acknowledgedOrder(response, preview);
      if (!order) throw new KalshiRequestError(201, true);
      return order;
    },
    reconcile: (row) => reconcileKnown(context, row),
    rejectionMessage: (error) => error instanceof KalshiRequestError && !error.uncertain ? error.message : null,
    blockedError: () => new TradingError("submission_blocked", "Another submission is unresolved, or the durable order ledger is unavailable. Refresh the account before continuing.", 409),
  });
}

export async function cancelTradingOrder(context: TradingContext, orderId: string): Promise<OrderCancelResponse> {
  requireTradingEnabled();
  const { client } = connected(context);
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(orderId)) throw new TradingError("invalid_order_id", "The exchange order ID is invalid.");
  const raw = asObject((await client.request(`/portfolio/orders/${encodeURIComponent(orderId)}`)).order);
  const order = normalizeOrder(raw);
  if (!order || order.id !== orderId || (raw.subaccount_number !== undefined && raw.subaccount_number !== null && raw.subaccount_number !== 0)) throw new TradingError("order_not_found", "The order was not found in this connected primary account.", 404);
  if (order.status !== "resting" || order.remainingCount === 0) return { status: "not_open", orderId, canceledCount: 0, message: "This order has no resting quantity to cancel. Existing fills remain unchanged." };
  if (order.remainingCount === null) throw new TradingError("order_unavailable", "The remaining quantity could not be verified. Refresh before canceling.", 503);
  try {
    const result = await client.request(`/portfolio/events/orders/${encodeURIComponent(orderId)}?market_ticker=${encodeURIComponent(order.ticker)}&subaccount=0&exchange_index=-1`, "DELETE");
    const canceledCount = finiteNumber(result.reduced_by);
    if (result.order_id !== orderId || canceledCount === null || canceledCount < 0) throw new KalshiRequestError(200, true);
    return { status: "canceled", orderId, canceledCount, message: "The remaining contracts were canceled. Contracts already filled are unchanged." };
  } catch (error) {
    if (error instanceof KalshiRequestError && !error.uncertain) throw error;
    return { status: "unknown", orderId, canceledCount: null, message: "Cancellation outcome is unknown. Refresh your orders directly from Kalshi before taking another action." };
  }
}

export function tradingErrorResponse(error: unknown) {
  if (error instanceof TradingError) return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
  if (error instanceof KalshiRequestError) return Response.json({ error: error.message, code: "exchange_unavailable" }, { status: error.status === 401 || error.status === 403 ? 409 : 502, headers: { "Cache-Control": "private, no-store" } });
  return Response.json({ error: "Trading is temporarily unavailable. Refresh the account to reconcile any pending order.", code: "trading_unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
}
export function tradingJson(value: unknown) { return Response.json(value, { headers: { "Cache-Control": "private, no-store" } }); }
