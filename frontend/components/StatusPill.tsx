import clsx from "clsx";
import { STATUS_LABEL, STATUS_PILL_CLASS } from "@/lib/format";
import type { OrderStatus } from "@/lib/api";

const LIVE_STATUSES: OrderStatus[] = [
  "assigned",
  "picked_up",
  "delivering",
  "at_customer",
];

export function StatusPill({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const showDot = LIVE_STATUSES.includes(status);
  return (
    <span className={clsx(STATUS_PILL_CLASS[status], className)}>
      {showDot && <span className="live-dot" />}
      {STATUS_LABEL[status]}
    </span>
  );
}
