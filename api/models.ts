import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Models list proxy — two key modes (same as claude.ts):
 * 1. Vault: VAULT_KEY_ANTHROPIC env var + auth token
 * 2. Passthrough: user provides X-API-Key header
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Vault-Token, X-Session-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Resolve API key: vault first, then passthrough
  let apiKey: string | null = null;

  const vaultKey = process.env.VAULT_KEY_ANTHROPIC;
  if (vaultKey) {
    const vaultToken = process.env.HERMITCRAB_VAULT_TOKEN;
    const headerVaultToken = req.headers['x-vault-token'] as string;
    const sessionToken = req.headers['x-session-token'] as string;

    if (vaultToken && headerVaultToken === vaultToken) {
      apiKey = vaultKey;
    } else if (vaultToken && sessionToken) {
      const { createHmac } = await import('crypto');
      const parts = sessionToken.split(':');
      if (parts.length === 3) {
        const [expiresStr, nonce, sig] = parts;
        if (Date.now() <= parseInt(expiresStr)) {
          const expected = createHmac('sha256', vaultToken).update(`${expiresStr}:${nonce}`).digest('hex');
          if (sig === expected) apiKey = vaultKey;
        }
      }
    }
  }

  if (!apiKey) {
    apiKey = req.headers['x-api-key'] as string;
  }

  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(400).json({ error: 'Valid Anthropic API key required via X-API-Key header or vault.' });
  }

  try {
    const limit = req.query.limit || '100';
    const response = await fetch(`https://api.anthropic.com/v1/models?limit=${limit}`, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Models proxy error:', error);
    return res.status(500).json({ error: 'Proxy error' });
  }
}
