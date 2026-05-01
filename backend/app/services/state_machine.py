"""
Order state machine — escrow-aware version.

Happy path:
    PENDING -> AWAITING_PAYMENT -> PAID_INTO_ESCROW -> ASSIGNED ->
    PICKED_UP -> DELIVERING -> AT_CUSTOMER -> DELIVERED -> APPROVED -> SETTLED

Branches:
    AT_CUSTOMER -> DISPUTED -> REFUNDED  (customer rejects)
    Any state up to APPROVED -> FAILED   (cancellation, no-show)
"""
from app.db.models import OrderStatus


class StateError(Exception):
    """Raised when an order transition is not allowed."""


_ALLOWED: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PENDING: {OrderStatus.AWAITING_PAYMENT, OrderStatus.FAILED},
    OrderStatus.AWAITING_PAYMENT: {OrderStatus.PAID_INTO_ESCROW, OrderStatus.FAILED},
    OrderStatus.PAID_INTO_ESCROW: {OrderStatus.ASSIGNED, OrderStatus.FAILED},
    OrderStatus.ASSIGNED: {OrderStatus.PICKED_UP, OrderStatus.FAILED},
    OrderStatus.PICKED_UP: {OrderStatus.DELIVERING, OrderStatus.FAILED},
    OrderStatus.DELIVERING: {OrderStatus.AT_CUSTOMER, OrderStatus.FAILED},
    OrderStatus.AT_CUSTOMER: {OrderStatus.DELIVERED, OrderStatus.DISPUTED, OrderStatus.FAILED},
    OrderStatus.DELIVERED: {OrderStatus.APPROVED, OrderStatus.DISPUTED},
    OrderStatus.APPROVED: {OrderStatus.SETTLED},
    OrderStatus.DISPUTED: {OrderStatus.REFUNDED, OrderStatus.SETTLED},  # can resolve either way
    OrderStatus.SETTLED: set(),
    OrderStatus.REFUNDED: set(),
    OrderStatus.FAILED: set(),
}


def assert_can_transition(current: OrderStatus, target: OrderStatus) -> None:
    allowed = _ALLOWED.get(current, set())
    if target not in allowed:
        raise StateError(
            f"Cannot transition from {current.value} to {target.value}. "
            f"Allowed: {sorted(s.value for s in allowed) or '(terminal)'}"
        )


def is_terminal(status: OrderStatus) -> bool:
    return status in (OrderStatus.SETTLED, OrderStatus.REFUNDED, OrderStatus.FAILED)


def is_active(status: OrderStatus) -> bool:
    return not is_terminal(status)
