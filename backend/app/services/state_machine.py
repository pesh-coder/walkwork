"""
Order state machine.

Rules:
- An order can only move forward (or to FAILED).
- Each transition has an allowed set of "from" states.
- Trying an illegal transition raises StateError.
"""
from app.db.models import OrderStatus


class StateError(Exception):
    """Raised when an order transition is not allowed."""


# from-state -> set of allowed to-states
_ALLOWED: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PENDING: {OrderStatus.ASSIGNED, OrderStatus.FAILED},
    OrderStatus.ASSIGNED: {OrderStatus.PICKED_UP, OrderStatus.FAILED},
    OrderStatus.PICKED_UP: {OrderStatus.DELIVERING, OrderStatus.FAILED},
    OrderStatus.DELIVERING: {OrderStatus.OTP_PENDING, OrderStatus.FAILED},
    OrderStatus.OTP_PENDING: {OrderStatus.DELIVERED, OrderStatus.FAILED},
    OrderStatus.DELIVERED: {OrderStatus.SETTLED},
    OrderStatus.SETTLED: set(),
    OrderStatus.FAILED: set(),
}


def assert_can_transition(current: OrderStatus, target: OrderStatus) -> None:
    """Raise StateError if `current -> target` is not a legal move."""
    allowed = _ALLOWED.get(current, set())
    if target not in allowed:
        raise StateError(
            f"Cannot transition order from {current.value} to {target.value}. "
            f"Allowed next states: {[s.value for s in allowed] or '(terminal)'}"
        )


def is_terminal(status: OrderStatus) -> bool:
    return status in (OrderStatus.SETTLED, OrderStatus.FAILED)
