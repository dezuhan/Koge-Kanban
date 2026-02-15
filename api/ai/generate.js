export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, model, options } = req.body;
  // SECURITY FIX: Use environment variable for Ollama host
  const serverHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  const clientHost = req.headers['x-ollama-endpoint'];

  // Allow override in dev or if explicitly allowed
  let ollamaHost = serverHost;
  if (clientHost && (process.env.NODE_ENV !== 'production' || process.env.ALLOW_CLIENT_OLLAMA_HOST === 'true')) {
    ollamaHost = clientHost;
  }

  // Ensure host doesn't have trailing slash and has protocol
  const cleanHost = ollamaHost.startsWith('http') ? ollamaHost.replace(/\/+$/, '') : `http://${ollamaHost.replace(/\/+$/, '')}`;

  const targetModel = model || "qwen2.5:3b";

  try {
    const requestBody = {
      model: targetModel,
      prompt: prompt,
      stream: false
    };

    if (options) {
      requestBody.options = options;
    }

    const ollamaRes = await fetch(`${cleanHost}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!ollamaRes.ok) {
      const errorText = await ollamaRes.text();
      return res.status(ollamaRes.status).json({
        error: `Ollama error: ${ollamaRes.statusText}`,
        details: errorText
      });
    }

    const data = await ollamaRes.json();
    res.status(200).json({ response: data.response });

  } catch (error) {
    console.error("Vercel AI Generate Proxy Error:", error.message);
    res.status(500).json({ error: `Gagal menghubungi Ollama: ${error.message}` });
  }
}
