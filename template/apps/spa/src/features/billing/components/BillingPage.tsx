/**
 * Billing Page
 * Stripe Pricing Table and Customer Portal
 */
import { useAuth, useOrganization } from '@clerk/clerk-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';

const STRIPE_PRICING_TABLE_ID = import.meta.env.VITE_STRIPE_PRICING_TABLE_ID;
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export function BillingPage() {
  const { getToken } = useAuth();
  const { organization, membership } = useOrganization();
  const isAdmin = !organization || membership?.role === 'org:admin';

  // Fetch subscription info
  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch('/api/billing/subscription', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch subscription');
      return response.json();
    },
  });

  // Fetch customer session for pricing table
  const { data: customerSession } = useQuery({
    queryKey: ['customer-session'],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch('/api/billing/customer-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to create customer session');
      return response.json();
    },
    enabled: isAdmin && !!STRIPE_PRICING_TABLE_ID,
  });

  // Open customer portal
  const portalMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to create portal session');
      return response.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  if (isLoadingSubscription) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing settings
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your current subscription status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">
                {subscription?.planType || 'FREE'}
              </p>
              {subscription?.subscription && (
                <p className="text-sm text-muted-foreground">
                  Renews on{' '}
                  {new Date(
                    subscription.subscription.currentPeriodEnd * 1000
                  ).toLocaleDateString()}
                </p>
              )}
            </div>
            {isAdmin && subscription?.hasCustomer && (
              <Button
                variant="outline"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pricing Table */}
      {isAdmin && STRIPE_PRICING_TABLE_ID && STRIPE_PUBLISHABLE_KEY && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade Plan</CardTitle>
            <CardDescription>Choose a plan that fits your needs</CardDescription>
          </CardHeader>
          <CardContent>
            {customerSession?.clientSecret ? (
              <stripe-pricing-table
                pricing-table-id={STRIPE_PRICING_TABLE_ID}
                publishable-key={STRIPE_PUBLISHABLE_KEY}
                customer-session-client-secret={customerSession.clientSecret}
              />
            ) : (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isAdmin && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Contact your organization admin to manage billing settings.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Stripe Pricing Table type declaration
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-pricing-table': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'pricing-table-id': string;
          'publishable-key': string;
          'customer-session-client-secret'?: string;
        },
        HTMLElement
      >;
    }
  }
}
