import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Claude API Proxy — two key modes:
 *
 * 1. VAULT MODE: If VAULT_KEY_ANTHROPIC is set in Vercel env vars,
 *    uses the vault key. Authenticated via X-Vault-Token or X-Session-Token.
 *    The user's key never leaves the server.
 *
 * 2. PASSTHROUGH MODE (legacy): User provides their own API key via
 *    X-API-Key header. Proxied to Anthropic for CORS bypass only.
 *
 * Vault mode takes priority. If the vault key exists AND the request
 * is authenticated, it's used. Otherwise falls back to passthrough.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Vault-Token, X-Session-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Resolve API key: vault first, then passthrough
  let apiKey: string | null = null;
  let keySource = 'none';

  const vaultKey = process.env.VAULT_KEY_ANTHROPIC;
  if (vaultKey) {
    // Vault mode — check auth
    const vaultToken = process.env.HERMITCRAB_VAULT_TOKEN;
    const headerVaultToken = req.headers['x-vault-token'] as string;
    const sessionToken = req.headers['x-session-token'] as string;

    if (vaultToken && headerVaultToken === vaultToken) {
      apiKey = vaultKey;
      keySource = 'vault-direct';
    } else if (vaultToken && sessionToken) {
      // Verify session token (same logic as vault.ts)
      const { createHmac } = await import('crypto');
      const parts = sessionToken.split(':');
      if (parts.length === 3) {
        const [expiresStr, nonce, sig] = parts;
        if (Date.now() <= parseInt(expiresStr)) {
          const expected = createHmac('sha256', vaultToken).update(`${expiresStr}:${nonce}`).digest('hex');
          if (sig === expected) {
            apiKey = vaultKey;
            keySource = 'vault-session';
          }
        }
      }
    }
  }

  // Fallback: passthrough mode (user provides key)
  if (!apiKey) {
    apiKey = req.headers['x-api-key'] as string || req.body?.apiKey;
    if (apiKey) keySource = 'passthrough';
  }

  if (!apiKey) {
    return res.status(400).json({
      error: 'API key required. Set VAULT_KEY_ANTHROPIC in Vercel env vars, or provide via X-API-Key header.',
    });
  }

  if (!apiKey.startsWith('sk-ant-')) {
    return res.status(400).json({
      error: 'Invalid API key format. Anthropic keys start with sk-ant-',
    });
  }

  try {
    // Extract ALL fields from request body — pass through everything
    const {
      model,
      max_tokens,
      system,
      messages,
      tools,
      tool_choice,
      thinking,
      temperature,
      top_p,
      top_k,
      stop_sequences,
      metadata,
      // Strip client-only fields
      apiKey: _apiKey,
      sessionToken: _st,
      ...rest
    } = req.body;

    // Build request body — only include fields that are present
    const body: Record<string, unknown> = {
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: max_tokens || 4096,
      messages,
    };

    if (system) body.system = system;
    if (tools) body.tools = tools;
    if (tool_choice) body.tool_choice = tool_choice;
    if (thinking) body.thinking = thinking;
    if (temperature !== undefined) body.temperature = temperature;
    if (top_p !== undefined) body.top_p = top_p;
    if (top_k !== undefined) body.top_k = top_k;
    if (stop_sequences) body.stop_sequences = stop_sequences;
    if (metadata) body.metadata = metadata;

    // Build headers — include beta features
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'context-management-2025-06-27',
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    // Include key source in response headers for kernel diagnostics
    res.setHeader('X-Key-Source', keySource);
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Proxy error' });
  }
}
