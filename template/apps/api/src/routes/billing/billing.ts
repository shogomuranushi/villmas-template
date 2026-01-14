/**
 * Billing API Routes
 * Stripe Checkout, Customer Portal, Subscription Management
 */
import { Hono } from 'hono';
import Stripe from 'stripe';
import type { Env } from '../../types/env';
import type { Variables } from '../../middleware/auth';
import { PLAN_LIMITS, type PlanType } from '../../constants/plans';
import { getSubscriptionPlanType } from '../../utils/stripe-plan';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Get Clerk organization info
 */
async function getClerkOrganization(
  orgId: string,
  clerkSecretKey: string,
): Promise<{ name: string } | null> {
  try {
    const response = await fetch(`https://api.clerk.com/v1/organizations/${orgId}`, {
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
      },
    });
    if (response.ok) {
      return await response.json() as { name: string };
    }
  } catch (error) {
    console.error('Failed to fetch Clerk organization:', error);
  }
  return null;
}

/**
 * Get Clerk user info
 */
async function getClerkUser(
  userId: string,
  clerkSecretKey: string,
): Promise<{ email_addresses: Array<{ email_address: string }>; first_name?: string; last_name?: string } | null> {
  try {
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
      },
    });
    if (response.ok) {
      return await response.json() as { email_addresses: Array<{ email_address: string }>; first_name?: string; last_name?: string };
    }
  } catch (error) {
    console.error('Failed to fetch Clerk user:', error);
  }
  return null;
}

/**
 * Get or create Stripe customer for organization
 */
async function getOrCreateStripeCustomer(
  stripe: Stripe,
  stub: any,
  orgId: string,
  userId: string,
  clerkSecretKey?: string,
): Promise<string> {
  // Check existing customer ID
  const existingOrg = (await stub.query(
    `SELECT stripe_customer_id FROM organization_settings WHERE id = 1`,
  )) as Array<{ stripe_customer_id: string | null }>;

  if (existingOrg.length > 0 && existingOrg[0].stripe_customer_id) {
    return existingOrg[0].stripe_customer_id;
  }

  // Get customer name and email
  let customerName = orgId;
  let customerEmail: string | undefined;

  if (clerkSecretKey) {
    if (orgId === userId) {
      // Personal account
      const user = await getClerkUser(userId, clerkSecretKey);
      if (user) {
        customerEmail = user.email_addresses[0]?.email_address;
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
        customerName = fullName || customerEmail || orgId;
      }
    } else {
      // Organization account
      const org = await getClerkOrganization(orgId, clerkSecretKey);
      if (org?.name) {
        customerName = org.name;
      }
    }
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    name: customerName,
    email: customerEmail,
    metadata: {
      organization_id: orgId,
      user_id: userId,
    },
  });

  // Save customer ID to DO
  await stub.query(
    `UPDATE organization_settings SET stripe_customer_id = ? WHERE id = 1`,
    [customer.id],
  );

  return customer.id;
}

/**
 * GET /api/billing/subscription
 * Get current subscription info
 */
app.get('/subscription', async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId') || userId;

  if (!orgId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
    });

    const doId = c.env.ORGANIZATION_STORAGE.idFromName(orgId);
    const stub = c.env.ORGANIZATION_STORAGE.get(doId);

    const existingOrg = (await stub.query(
      `SELECT stripe_customer_id FROM organization_settings WHERE id = 1`,
    )) as Array<{ stripe_customer_id: string | null }>;

    if (!existingOrg.length || !existingOrg[0].stripe_customer_id) {
      return c.json({
        planType: 'FREE',
        hasCustomer: false,
        subscription: null,
      });
    }

    const customerId = existingOrg[0].stripe_customer_id;
    const planType = await getSubscriptionPlanType(stripe, customerId);

    let subscription = null;
    if (planType !== 'FREE') {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
        expand: ['data.items.data.price.product'],
      });
      subscription = subscriptions.data[0] || null;
    }

    return c.json({
      planType,
      hasCustomer: true,
      customerId,
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      } : null,
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return c.json(
      {
        error: 'Failed to fetch subscription',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

/**
 * POST /api/billing/customer-session
 * Create Stripe Customer Session for Pricing Table
 */
app.post('/customer-session', async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId') || userId;

  if (!orgId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
    });

    const doId = c.env.ORGANIZATION_STORAGE.idFromName(orgId);
    const stub = c.env.ORGANIZATION_STORAGE.get(doId);

    const customerId = await getOrCreateStripeCustomer(
      stripe,
      stub,
      orgId,
      userId,
      c.env.CLERK_SECRET_KEY,
    );

    const customerSession = await stripe.customerSessions.create({
      customer: customerId,
      components: {
        pricing_table: {
          enabled: true,
        },
      },
    });

    return c.json({
      clientSecret: customerSession.client_secret,
      customerId,
    });
  } catch (error) {
    console.error('Customer session error:', error);
    return c.json(
      {
        error: 'Failed to create customer session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

/**
 * POST /api/billing/portal
 * Create Stripe Customer Portal session
 * Admin only for organizations
 */
app.post('/portal', async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId') || userId;
  const orgRole = c.get('orgRole');

  if (!orgId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  // Admin only for organizations
  if (orgId !== userId && orgRole !== 'org:admin') {
    return c.json({ error: 'Forbidden: Admin permission required' }, 403);
  }

  const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  const appUrl = c.env.APP_URL || 'http://localhost:5173';

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
    });

    const doId = c.env.ORGANIZATION_STORAGE.idFromName(orgId);
    const stub = c.env.ORGANIZATION_STORAGE.get(doId);

    const existingOrg = (await stub.query(
      `SELECT stripe_customer_id FROM organization_settings WHERE id = 1`,
    )) as Array<{ stripe_customer_id: string | null }>;

    if (!existingOrg.length || !existingOrg[0].stripe_customer_id) {
      return c.json({ error: 'No billing account found. Please subscribe first.' }, 404);
    }

    const customerId = existingOrg[0].stripe_customer_id;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard/settings/billing`,
    });

    return c.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error('Portal session error:', error);
    return c.json(
      {
        error: 'Failed to create portal session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

/**
 * GET /api/billing/usage
 * Get usage info for current plan
 */
app.get('/usage', async (c) => {
  const orgId = c.get('orgId') || c.get('userId');

  if (!orgId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
    });

    const doId = c.env.ORGANIZATION_STORAGE.idFromName(orgId);
    const stub = c.env.ORGANIZATION_STORAGE.get(doId);

    // Get customer ID
    const existingOrg = (await stub.query(
      `SELECT stripe_customer_id FROM organization_settings WHERE id = 1`,
    )) as Array<{ stripe_customer_id: string | null }>;

    // Get plan type
    let planType: PlanType = 'FREE';
    if (existingOrg.length > 0 && existingOrg[0].stripe_customer_id) {
      planType = await getSubscriptionPlanType(stripe, existingOrg[0].stripe_customer_id);
    }

    const limits = PLAN_LIMITS[planType];

    // TODO: Replace with your actual usage tracking
    const currentUsage = {
      items: 0,
      storage: 0,
    };

    return c.json({
      planType,
      limits,
      usage: currentUsage,
      canAddMore: currentUsage.items < limits.maxItems,
    });
  } catch (error) {
    console.error('Usage fetch error:', error);
    return c.json(
      {
        error: 'Failed to fetch usage',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

export default app;
