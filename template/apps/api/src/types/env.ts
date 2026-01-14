/**
 * Cloudflare Workers Environment Types
 */
export interface Env {
  // Bindings
  ASSETS: Fetcher;
  ORGANIZATION_STORAGE: DurableObjectNamespace;

  // Secrets (set via wrangler secret put)
  CLERK_SECRET_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  INTERNAL_SECRET?: string;

  // Environment Variables
  APP_URL?: string;
  CLERK_ISSUER_URL?: string;
  STRIPE_PRICING_TABLE_ID?: string;
  STRIPE_STANDARD_PRICE_ID?: string;
  POSTHOG_API_KEY?: string;
}
