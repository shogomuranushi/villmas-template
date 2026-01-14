/**
 * Stripe Plan Utilities
 */
import type Stripe from 'stripe';
import type { PlanType } from '../constants/plans';

/**
 * Get subscription plan type from Stripe customer
 */
export async function getSubscriptionPlanType(
  stripe: Stripe,
  customerId: string,
): Promise<PlanType> {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return 'FREE';
    }

    // Check if enterprise (customize based on your price IDs)
    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price?.id;

    // TODO: Replace with your actual price IDs
    // if (priceId === 'price_enterprise_xxx') {
    //   return 'ENTERPRISE';
    // }

    return 'STANDARD';
  } catch (error) {
    console.error('Failed to get subscription plan:', error);
    return 'FREE';
  }
}
