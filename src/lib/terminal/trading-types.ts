/** Browser-safe contracts for authenticated, real-money Kalshi manual trading. */
export type TradingSide = "yes" | "no";

export interface TerminalOrder {
  id: string;
  clientOrderId: string | null;
  ticker: string;
  side: TradingSide | null;
  status: string;
  limitPrice: number | null;
  count: number | null;
  filledCount: number | null;
  remainingCount: number | null;
  createdAt: string | null;
}

export interface TerminalFill {
  id: string;
  orderId: string;
  ticker: string;
  side: TradingSide | null;
  price: number | null;
  count: number | null;
  feeDollars: number | null;
  createdAt: string | null;
}

export interface TerminalPosition {
  ticker: string;
  side: TradingSide | null;
  count: number | null;
  marketExposureDollars: number | null;
  realizedPnlDollars: number | null;
  feesPaidDollars: number | null;
}

export interface PendingSubmission {
  clientOrderId: string;
  ticker: string;
  status: "submitting" | "unknown";
}

export interface TerminalAccount {
  connection: "connected" | "not_connected" | "unavailable";
  tradingEnabled: boolean;
  reason: string | null;
  balanceDollars: number | null;
  portfolioValueDollars: number | null;
  orders: TerminalOrder[];
  fills: TerminalFill[];
  positions: TerminalPosition[];
  pendingSubmission: PendingSubmission | null;
  /** True means the exchange page limit prevented a complete account snapshot. */
  partial: boolean;
  fetchedAt: string;
}

export interface OrderPreviewRequest {
  ticker: string;
  side: TradingSide;
  count: number;
  /** Per-contract limit in dollars for the selected outcome. */
  limitPrice: number;
}

export interface OrderPreview extends OrderPreviewRequest {
  clientOrderId: string;
  question: string;
  action: "buy";
  timeInForce: "good_till_canceled";
  notionalDollars: number;
  estimatedFeeDollars: number;
  maxCostDollars: number;
  feeDescription: string;
  expiresAt: string;
  tradingEnabled: boolean;
}

export interface OrderPreviewResponse {
  preview: OrderPreview;
  previewToken: string;
}

export interface OrderSubmitRequest {
  previewToken: string;
  confirmed: true;
}

export interface OrderSubmitResponse {
  status: "accepted" | "rejected" | "unknown";
  order: TerminalOrder | null;
  clientOrderId: string;
  message: string;
}

export interface OrderCancelResponse {
  status: "canceled" | "not_open" | "unknown";
  orderId: string;
  canceledCount: number | null;
  message: string;
}

export interface TradingErrorResponse {
  error: string;
  code: string;
}
