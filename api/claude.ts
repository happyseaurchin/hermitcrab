import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * FULL PASSTHROUGH Claude API Proxy
 *
 * User provides their OWN API key.
 * This proxy exists purely to bypass browser CORS restrictions.
 * It passes through EVERYTHING the Claude API accepts.
 * No filtering. No stripping. The instance gets full Claude capabilities.
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from request
  const apiKey = req.headers['x-api-key'] as string || req.body.apiKey;

  if (!apiKey) {
    return res.status(400).json({
      error: 'API key required. Provide your Anthropic API key via X-API-Key header.'
    });
  }

  if (!apiKey.startsWith('sk-ant-')) {
    return res.status(400).json({
      error: 'Invalid API key format. Anthropic keys start with sk-ant-'
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
      // Enable ALL beta features the instance might use
      'anthropic-beta': 'web-fetch-2025-09-10,code-execution-2025-08-25,context-management-2025-06-27',
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Proxy error' });
  }
}
