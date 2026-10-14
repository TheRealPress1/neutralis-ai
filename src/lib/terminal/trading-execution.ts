import type { OrderPreview, OrderSubmitResponse, TerminalOrder } from "./trading-types";

type SubmissionStatus = "submitting" | "unknown" | "accepted" | "rejected";
/** All writes pass this durable claim boundary. Reconciliation is always read-only. */
export async function executeOnce<RecordType>(options: {
  preview: OrderPreview;
  lookup: () => Promise<RecordType | null>;
  claim: () => Promise<boolean>;
  save: (status: SubmissionStatus, orderId?: string) => Promise<boolean>;
  send: () => Promise<TerminalOrder>;
  reconcile: (record: RecordType) => Promise<OrderSubmitResponse>;
  rejectionMessage: (error: unknown) => string | null;
  blockedError: () => Error;
  now?: () => number;
}): Promise<OrderSubmitResponse> {
  const { preview } = options;
  const existing = await options.lookup();
  if (existing) return options.reconcile(existing);
  if (!(await options.claim())) {
    const claimed = await options.lookup();
    if (claimed) return options.reconcile(claimed);
    throw options.blockedError();
  }
  // A read-only status check cannot report an expired, unclaimed preview while a
  // delayed server request later turns that preview into an exchange write.
  if (Date.parse(preview.expiresAt) <= (options.now ?? Date.now)()) {
    await options.save("rejected");
    return { status: "rejected", order: null, clientOrderId: preview.clientOrderId, message: "The review expired before submission. No exchange order was sent." };
  }
  try {
    const order = await options.send();
    await options.save("accepted", order.id);
    return { status: "accepted", order, clientOrderId: preview.clientOrderId, message: "Kalshi accepted the order. Filled and remaining quantities are shown separately." };
  } catch (error) {
    const rejected = options.rejectionMessage(error);
    const saved = await options.save(rejected ? "rejected" : "unknown");
    if (rejected && saved) return { status: "rejected", order: null, clientOrderId: preview.clientOrderId, message: rejected };
    // Transport errors and upstream ambiguity never trigger another send.
    const record = await options.lookup();
    return record ? options.reconcile(record) : { status: "unknown", order: null, clientOrderId: preview.clientOrderId,
      message: "The submission outcome is unknown. Check status before placing another order." };
  }
}
