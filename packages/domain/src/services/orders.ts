/** Order lifecycle. Every status change goes through `assertTransition`. */

export const ORDER_STATUSES = ["pending_payment", "paid", "in_progress", "delivered", "completed", "cancelled", "refunded", "disputed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["in_progress", "delivered", "refunded", "cancelled", "disputed"],
  in_progress: ["delivered", "refunded", "disputed"],
  // A revision request sends a delivered order back to work.
  delivered: ["completed", "in_progress", "disputed", "refunded"],
  completed: ["disputed", "refunded"],
  disputed: ["completed", "refunded", "in_progress"],
  cancelled: [],
  refunded: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => NEXT[from]?.includes(to) ?? false;

export class OrderTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`An order that is ${from.replace("_", " ")} can't become ${to.replace("_", " ")}`);
    this.name = "OrderTransitionError";
  }
}

export function assertTransition(from: string, to: OrderStatus): void {
  if (!canTransition(from as OrderStatus, to)) throw new OrderTransitionError(from, to);
}

/** Orders the expert is working on (count against their capacity). */
export const ACTIVE_STATUSES: OrderStatus[] = ["paid", "in_progress", "delivered", "disputed"];

/** How long a delivered order waits for the buyer before it completes by itself. */
export const AUTO_COMPLETE_DAYS = 7;
