/**
 * {{ project_slug }} API
 * Hono + Cloudflare Workers
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types/env';
import { clerkAuth, type Variables } from './middleware/auth';

// Routes
import billingRoute from './routes/billing/billing';

// Durable Objects
export { OrganizationStorage } from './durable-objects/organization-storage';

// Hono Application
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS Middleware
app.use(
  '/*',
  cors({
    origin: (origin) => {
      // Development: allow localhost
      if (origin.includes('localhost')) return origin;
      // Production: allow your domains
      if (origin.endsWith('.workers.dev')) return origin;
      if (origin.endsWith('.pages.dev')) return origin;
      return origin;
    },
    credentials: true,
  }),
);

// Health Check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root Endpoint
app.get('/', (c) => {
  return c.json({
    message: '{{ project_name }} API - Powered by Hono + Cloudflare Workers',
    version: '0.1.0',
  });
});

// Apply auth middleware to API routes
app.use('/api/*', clerkAuth);

// API Routes
app.route('/api/billing', billingRoute);

// TODO: Add your custom API routes here
// app.route('/api/your-feature', yourFeatureRoute);

// Static Assets Fallback (SPA support)
app.get('*', async (c) => {
  if (!c.env.ASSETS) {
    return c.json({ error: 'Not found' }, 404);
  }

  const response = await c.env.ASSETS.fetch(c.req.raw);

  // Return index.html for SPA routing
  if (response.status === 404) {
    const indexResponse = await c.env.ASSETS.fetch(
      new Request(new URL('/', c.req.url)),
    );
    return indexResponse;
  }

  return response;
});

export default app;
