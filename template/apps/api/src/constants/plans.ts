/**
 * Plan Limits Configuration
 * Customize these values based on your SaaS pricing
 */
export const PLAN_LIMITS = {
  FREE: {
    maxItems: 10,
    maxStorage: 100, // MB
    features: ['basic'],
  },
  STANDARD: {
    maxItems: 100,
    maxStorage: 1000, // MB
    features: ['basic', 'advanced'],
  },
  ENTERPRISE: {
    maxItems: Infinity,
    maxStorage: Infinity,
    features: ['basic', 'advanced', 'enterprise'],
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;
