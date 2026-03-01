import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, randomBytes } from 'crypto';

/**
 * HERMITCRAB VAULT — Secure key storage and service proxy
 *
 * Three auth methods:
 *   1. Direct token: HERMITCRAB_VAULT_TOKEN in env, passed via X-Vault-Token header.
 *      Used by kernel (Loop B) for key management operations.
 *   2. Kernel-mediated: kernel adds auth automatically. LLM calls service_call tool,
 *      kernel adds the vault token. LLM never sees the secret.
 *   3. Session-signed URLs: at boot, kernel calls /api/vault?action=session to get
 *      a time-limited token. LLM uses web_fetch (Loop A) with the token.
 *
 * Key storage: Vercel env vars. Format: VAULT_KEY_{SERVICE}
 *   e.g. VAULT_KEY_ANTHROPIC, VAULT_KEY_GMAIL, VAULT_KEY_GITHUB
 *
 * Service proxy: POST /api/vault with action=proxy to call external services
 * using stored keys. The LLM describes what it wants; the vault executes.
 */

// CORS — same origins as claude.ts
function setCORS(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://hermitcrab.me',
    'https://www.hermitcrab.me',
    'https://seed.machus.ai',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Vault-Token, X-Session-Token');
}

// Auth: verify one of the three methods
function authenticate(req: VercelRequest): { method: string; valid: boolean } {
  const vaultToken = process.env.HERMITCRAB_VAULT_TOKEN;
  if (!vaultToken) return { method: 'none', valid: false };

  // Method 1: Direct vault token (kernel/admin)
  const headerToken = req.headers['x-vault-token'] as string;
  if (headerToken && headerToken === vaultToken) {
    return { method: 'direct', valid: true };
  }

  // Method 3: Session token (time-limited, for LLM Loop A via web_fetch)
  const sessionToken = req.headers['x-session-token'] as string
    || (req.body?.sessionToken as string);
  if (sessionToken) {
    const valid = verifySessionToken(sessionToken, vaultToken);
    return { method: 'session', valid };
  }

  return { method: 'none', valid: false };
}

// Session tokens: HMAC-signed, time-limited
function createSessionToken(vaultToken: string, ttlMinutes: number = 60): string {
  const expires = Date.now() + ttlMinutes * 60 * 1000;
  const nonce = randomBytes(8).toString('hex');
  const payload = `${expires}:${nonce}`;
  const sig = createHmac('sha256', vaultToken).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

function verifySessionToken(token: string, vaultToken: string): boolean {
  const parts = token.split(':');
  if (parts.length !== 3) return false;
  const [expiresStr, nonce, sig] = parts;
  const expires = parseInt(expiresStr);
  if (Date.now() > expires) return false;
  const payload = `${expiresStr}:${nonce}`;
  const expected = createHmac('sha256', vaultToken).update(payload).digest('hex');
  return sig === expected;
}

// Get a stored key by service name
function getServiceKey(service: string): string | null {
  const envKey = `VAULT_KEY_${service.toUpperCase()}`;
  return process.env[envKey] || null;
}

// List available services (names only, never keys)
function listServices(): string[] {
  const prefix = 'VAULT_KEY_';
  return Object.keys(process.env)
    .filter(k => k.startsWith(prefix))
    .map(k => k.slice(prefix.length).toLowerCase());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { action } = req.body || {};

  // Health check — no auth needed
  if (action === 'health') {
    return res.status(200).json({
      vault: true,
      configured: !!process.env.HERMITCRAB_VAULT_TOKEN,
      services: listServices(),
    });
  }

  // Auth required for everything else
  const auth = authenticate(req);
  if (!auth.valid) {
    return res.status(401).json({ error: 'Unauthorized', method: auth.method });
  }

  switch (action) {
    // Generate a session token (Method 3) — kernel calls this at boot
    case 'session': {
      const ttl = req.body.ttl || 60; // minutes
      const vaultToken = process.env.HERMITCRAB_VAULT_TOKEN!;
      const token = createSessionToken(vaultToken, ttl);
      return res.status(200).json({ sessionToken: token, expiresIn: ttl * 60, method: 'session' });
    }

    // List available services
    case 'list': {
      return res.status(200).json({ services: listServices() });
    }

    // Store a key (user entrusts hermitcrab with an API key)
    // This writes to Vercel env vars via the Vercel API — requires VERCEL_TOKEN
    case 'store': {
      const { service, key } = req.body;
      if (!service || !key) return res.status(400).json({ error: 'service and key required' });
      // For now: keys are set via Vercel dashboard or CLI.
      // Runtime storage would require Vercel API + VERCEL_TOKEN + project ID.
      // Return guidance instead.
      return res.status(200).json({
        note: 'Runtime key storage not yet implemented. Set VAULT_KEY_' + service.toUpperCase() + ' in Vercel environment variables.',
        service,
      });
    }

    // Proxy: call an external service using stored key
    case 'proxy': {
      const { service, url, method, headers, body } = req.body;
      if (!service) return res.status(400).json({ error: 'service required' });
      const apiKey = getServiceKey(service);
      if (!apiKey) return res.status(404).json({ error: `No key stored for service: ${service}` });

      // Build the proxied request
      const proxyUrl = url || getDefaultServiceUrl(service);
      if (!proxyUrl) return res.status(400).json({ error: 'url required (no default for this service)' });

      const proxyHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...injectServiceAuth(service, apiKey),
        ...(headers || {}),
      };

      try {
        const proxyRes = await fetch(proxyUrl, {
          method: method || 'GET',
          headers: proxyHeaders,
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(15000),
        });
        const data = await proxyRes.text();
        const maxLen = 50000;
        const truncated = data.length > maxLen ? data.slice(0, maxLen) + '\n[TRUNCATED]' : data;
        return res.status(200).json({
          status: proxyRes.status,
          contentType: proxyRes.headers.get('content-type'),
          content: truncated,
        });
      } catch (e: any) {
        return res.status(200).json({ error: e.message || 'proxy request failed' });
      }
    }

    // Anthropic API passthrough — replaces direct key from localStorage
    case 'claude': {
      const apiKey = getServiceKey('anthropic');
      if (!apiKey) return res.status(404).json({ error: 'No Anthropic key configured. Set VAULT_KEY_ANTHROPIC in Vercel env vars.' });

      const {
        model, max_tokens, system, messages, tools, tool_choice,
        thinking, temperature, top_p, top_k, stop_sequences, metadata,
      } = req.body;

      const claudeBody: Record<string, unknown> = {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 4096,
        messages,
      };
      if (system) claudeBody.system = system;
      if (tools) claudeBody.tools = tools;
      if (tool_choice) claudeBody.tool_choice = tool_choice;
      if (thinking) claudeBody.thinking = thinking;
      if (temperature !== undefined) claudeBody.temperature = temperature;
      if (top_p !== undefined) claudeBody.top_p = top_p;
      if (top_k !== undefined) claudeBody.top_k = top_k;
      if (stop_sequences) claudeBody.stop_sequences = stop_sequences;
      if (metadata) claudeBody.metadata = metadata;

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'context-management-2025-06-27',
          },
          body: JSON.stringify(claudeBody),
        });
        const data = await response.json();
        return res.status(response.status).json(data);
      } catch (e: any) {
        return res.status(500).json({ error: 'Anthropic proxy error: ' + e.message });
      }
    }

    default:
      return res.status(400).json({ error: `Unknown action: ${action}`, available: ['health', 'session', 'list', 'store', 'proxy', 'claude'] });
  }
}

// Service-specific auth injection
function injectServiceAuth(service: string, apiKey: string): Record<string, string> {
  switch (service.toLowerCase()) {
    case 'anthropic':
      return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    case 'github':
      return { 'Authorization': `token ${apiKey}`, 'Accept': 'application/vnd.github.v3+json' };
    case 'gmail':
      return { 'Authorization': `Bearer ${apiKey}` };
    default:
      // Generic: use as Bearer token
      return { 'Authorization': `Bearer ${apiKey}` };
  }
}

// Default API base URLs per service
function getDefaultServiceUrl(service: string): string | null {
  switch (service.toLowerCase()) {
    case 'github': return 'https://api.github.com';
    case 'gmail': return 'https://gmail.googleapis.com/gmail/v1/users/me';
    default: return null;
  }
}
