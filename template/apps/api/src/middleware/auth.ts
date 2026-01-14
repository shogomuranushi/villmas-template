/**
 * Clerk Authentication Middleware
 * Verifies JWT tokens from Clerk and extracts user/org information
 */
import { createMiddleware } from 'hono/factory';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { Env } from '../types/env';

export interface Variables {
  userId: string;
  orgId: string | null;
  orgRole: string | null;
}

interface ClerkJWTPayload {
  sub: string;
  org_id?: string;
  org_role?: string;
  org_slug?: string;
}

/**
 * Clerk認証ミドルウェア
 */
export const clerkAuth = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    // Clerk の JWKS エンドポイントから公開鍵を取得
    const issuerUrl = c.env.CLERK_ISSUER_URL;
    if (!issuerUrl) {
      console.error('CLERK_ISSUER_URL is not configured');
      return c.json({ error: 'Server configuration error' }, 500);
    }

    const JWKS = createRemoteJWKSet(new URL(`${issuerUrl}/.well-known/jwks.json`));

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: issuerUrl,
    });

    const clerkPayload = payload as ClerkJWTPayload;

    // ユーザー情報をコンテキストに設定
    c.set('userId', clerkPayload.sub);
    c.set('orgId', clerkPayload.org_id || null);
    c.set('orgRole', clerkPayload.org_role || null);

    await next();
  } catch (error) {
    console.error('JWT verification failed:', error);
    return c.json({ error: 'Unauthorized: Invalid token' }, 401);
  }
});

/**
 * 内部API認証ミドルウェア（DO間通信用）
 */
export const internalAuth = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const internalToken = c.req.header('X-Internal-Token');

  if (!internalToken) {
    return c.json({ error: 'Unauthorized: Missing internal token' }, 401);
  }

  try {
    const secretKey = new TextEncoder().encode(
      c.env.INTERNAL_SECRET || 'development-secret-key'
    );

    const { payload } = await jwtVerify(internalToken, secretKey);

    c.set('userId', payload.userId as string);
    c.set('orgId', payload.orgId as string);
    c.set('orgRole', null);

    await next();
  } catch (error) {
    console.error('Internal token verification failed:', error);
    return c.json({ error: 'Unauthorized: Invalid internal token' }, 401);
  }
});
