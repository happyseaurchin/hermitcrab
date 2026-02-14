// Proxy for web_fetch tool — allows instance to visit URLs without CORS
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url required' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Hermitcrab/0.3 (hermitcrab kernel)',
        'Accept': 'text/html,application/xhtml+xml,text/plain,*/*',
      },
      signal: AbortSignal.timeout(10000),
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    // Truncate to avoid massive responses
    const maxLen = 50000;
    const truncated = text.length > maxLen ? text.slice(0, maxLen) + '\n\n[TRUNCATED]' : text;

    return res.status(200).json({
      status: response.status,
      contentType,
      length: text.length,
      content: truncated,
    });
  } catch (e: any) {
    return res.status(200).json({
      status: 0,
      error: e.message || 'fetch failed',
    });
  }
}
