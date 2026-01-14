/**
 * Organization Storage Durable Object
 *
 * Each organization gets its own SQLite storage:
 * - organization_settings (Stripe customer ID, etc.)
 * - Custom business data tables
 *
 * Usage:
 *   const doId = c.env.ORGANIZATION_STORAGE.idFromName(orgId);
 *   const stub = c.env.ORGANIZATION_STORAGE.get(doId);
 */
import { DurableObject } from 'cloudflare:workers';
import { SignJWT } from 'jose';
import type { Env } from '../types/env';

const DEFAULT_INTERNAL_SECRET = 'development-secret-key';

export class OrganizationStorage extends DurableObject<Env> {
  private sql: SqlStorage;
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
  }

  /**
   * Initialize database tables
   */
  private async ensureInitialized() {
    if (this.initialized) return;

    // Organization settings (billing)
    await this.sql.exec(`
      CREATE TABLE IF NOT EXISTS organization_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stripe_customer_id TEXT,
        creator_user_id TEXT,
        creator_email TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Insert default record
    await this.sql.exec(`
      INSERT OR IGNORE INTO organization_settings (id) VALUES (1)
    `);

    // TODO: Add your custom tables here
    // Example:
    // await this.sql.exec(`
    //   CREATE TABLE IF NOT EXISTS your_table (
    //     id INTEGER PRIMARY KEY AUTOINCREMENT,
    //     name TEXT NOT NULL,
    //     created_at INTEGER NOT NULL DEFAULT (unixepoch())
    //   )
    // `);

    this.initialized = true;
  }

  /**
   * Execute SQL query with parameters
   */
  async query<T = unknown>(sql: string, ...params: unknown[]): Promise<T[]> {
    await this.ensureInitialized();
    const flatParams = params.length === 1 && Array.isArray(params[0])
      ? params[0]
      : params;
    const cursor = this.sql.exec(sql, ...flatParams);
    const results: T[] = [];
    for (const row of cursor) {
      results.push(row as T);
    }
    return results;
  }

  /**
   * Get single record
   */
  async queryOne<T = unknown>(sql: string, ...params: unknown[]): Promise<T | null> {
    const results = await this.query<T>(sql, ...params);
    return results[0] ?? null;
  }

  /**
   * Execute INSERT/UPDATE/DELETE
   */
  async exec(sql: string, ...params: unknown[]): Promise<void> {
    await this.ensureInitialized();
    const flatParams = params.length === 1 && Array.isArray(params[0])
      ? params[0]
      : params;
    this.sql.exec(sql, ...flatParams);
  }

  /**
   * HTTP request handler
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      await this.ensureInitialized();
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Storage stats
    if (url.pathname === '/storage-stats') {
      const stats = await this.getStorageStats();
      return new Response(JSON.stringify(stats), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Store orgId (called from authenticated Worker API)
    if (url.pathname === '/store-org-id' && request.method === 'POST') {
      try {
        const body = await request.json() as { orgId: string };
        if (body.orgId) {
          await this.ctx.storage.put('orgId', body.orgId);
          return new Response(JSON.stringify({ status: 'ok' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (error) {
        console.error('Failed to store orgId:', error);
      }
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Get orgId from storage
   */
  private async getOrgId(): Promise<string> {
    const storedOrgId = await this.ctx.storage.get<string>('orgId');
    if (storedOrgId) return storedOrgId;
    return this.ctx.id.name || this.ctx.id.toString();
  }

  /**
   * Generate internal token for DO-to-DO communication
   */
  async generateInternalToken(orgId: string, userId: string): Promise<string> {
    const secretKey = new TextEncoder().encode(
      this.env.INTERNAL_SECRET || DEFAULT_INTERNAL_SECRET,
    );
    const token = await new SignJWT({ orgId, userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secretKey);
    return token;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    await this.ensureInitialized();

    const storageBytesRaw = this.sql.databaseSize;

    return {
      storageBytesRaw,
      storageMB: Math.round(storageBytesRaw / 1024 / 1024 * 100) / 100,
      storagePercent: Math.round(storageBytesRaw / (10 * 1024 * 1024 * 1024) * 10000) / 100,
    };
  }

  /**
   * Set creator info (only if not already set)
   */
  async setCreatorIfNotSet(userId: string, email?: string): Promise<void> {
    await this.ensureInitialized();
    const current = await this.queryOne<{ creator_user_id: string | null }>(
      'SELECT creator_user_id FROM organization_settings WHERE id = 1',
    );
    if (!current?.creator_user_id) {
      await this.exec(
        'UPDATE organization_settings SET creator_user_id = ?, creator_email = ?, updated_at = ? WHERE id = 1',
        userId,
        email || null,
        Math.floor(Date.now() / 1000),
      );
    }
  }
}

export interface StorageStats {
  storageBytesRaw: number;
  storageMB: number;
  storagePercent: number;
}
