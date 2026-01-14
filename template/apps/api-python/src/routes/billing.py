"""
Billing API Routes
Stripe Checkout, Customer Portal, Subscription Management
"""
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import stripe
import os

router = APIRouter()


@router.get("/subscription")
async def get_subscription(authorization: str = Header(...)):
    """Get current subscription info"""
    # TODO: Implement with your auth middleware
    stripe_secret = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_secret:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Placeholder response
    return {
        "planType": "FREE",
        "hasCustomer": False,
        "subscription": None,
    }


@router.post("/customer-session")
async def create_customer_session(authorization: str = Header(...)):
    """Create Stripe Customer Session for Pricing Table"""
    stripe_secret = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_secret:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    stripe.api_key = stripe_secret

    try:
        # TODO: Get or create customer from your database
        customer = stripe.Customer.create(
            metadata={"source": "api"},
        )

        session = stripe.CustomerSession.create(
            customer=customer.id,
            components={"pricing_table": {"enabled": True}},
        )

        return {
            "clientSecret": session.client_secret,
            "customerId": customer.id,
        }
    except stripe.StripeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/portal")
async def create_portal_session(authorization: str = Header(...)):
    """Create Stripe Customer Portal session"""
    stripe_secret = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_secret:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    stripe.api_key = stripe_secret
    app_url = os.environ.get("APP_URL", "http://localhost:5173")

    try:
        # TODO: Get customer ID from your database
        raise HTTPException(status_code=404, detail="No billing account found")
    except stripe.StripeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/usage")
async def get_usage(authorization: str = Header(...)):
    """Get usage info for current plan"""
    return {
        "planType": "FREE",
        "limits": {
            "maxItems": 10,
            "maxStorage": 100,
        },
        "usage": {
            "items": 0,
            "storage": 0,
        },
        "canAddMore": True,
    }
