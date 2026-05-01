"""
Customer service.

The "rider-learned map":
- First time a customer's phone is seen, we create a Customer record.
- When they confirm a pin on the tracking page, we save it on both the order
  AND on the Customer (last_lat, last_lng, last_landmark_photo, last_notes).
- Next time any seller creates an order for that phone, we pre-populate the
  pin from the Customer record. The rider doesn't have to wait for confirmation;
  they can start moving with the previously-confirmed location.
"""
from __future__ import annotations

import re
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import Customer, Order


def _normalize_phone(phone: str) -> str:
    p = re.sub(r"[\s\-()]+", "", phone or "")
    if p.startswith("0") and len(p) >= 9:
        p = "+256" + p[1:]
    elif p.startswith("256"):
        p = "+" + p
    elif p.isdigit() and len(p) == 9:
        p = "+256" + p
    return p


def get_or_create_customer(
    db: Session, phone: str, name: str | None = None
) -> Customer:
    phone = _normalize_phone(phone)
    customer = db.query(Customer).filter(Customer.phone == phone).first()
    if customer:
        if name and not customer.name:
            customer.name = name
            customer.updated_at = datetime.utcnow()
        return customer

    customer = Customer(phone=phone, name=name)
    db.add(customer)
    db.flush()
    return customer


def attach_customer_to_order(db: Session, order: Order) -> None:
    """
    Link an order to the Customer record. If the customer has a previously
    confirmed pin, copy it onto the order so the rider can start immediately.
    """
    customer = get_or_create_customer(db, order.customer_phone, order.customer_name)
    order.customer_id = customer.id

    # Inherit the pin if we have one
    if customer.last_lat and customer.last_lng:
        order.customer_lat = customer.last_lat
        order.customer_lng = customer.last_lng
        order.customer_plus_code = customer.last_plus_code
        order.customer_landmark_photo = customer.last_landmark_photo
        order.customer_address_notes = (
            order.customer_address_notes or customer.last_landmark_notes
        )
        order.customer_pin_confirmed_at = datetime.utcnow()


def update_customer_pin(
    db: Session,
    customer: Customer,
    *,
    lat: float,
    lng: float,
    plus_code: str | None,
    landmark_photo: str | None,
    landmark_notes: str | None,
    area: str | None = None,
) -> None:
    customer.last_lat = lat
    customer.last_lng = lng
    if plus_code:
        customer.last_plus_code = plus_code
    if landmark_photo:
        customer.last_landmark_photo = landmark_photo
    if landmark_notes:
        customer.last_landmark_notes = landmark_notes
    if area:
        customer.last_area = area
    customer.updated_at = datetime.utcnow()


def increment_delivery_count(db: Session, customer: Customer) -> None:
    customer.delivery_count = (customer.delivery_count or 0) + 1
    customer.updated_at = datetime.utcnow()
