export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, model, options } = req.body;
  // SECURITY FIX: Use environment variable for Ollama host
  const ollamaHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  const cleanHost = ollamaHost.endsWith('/') ? ollamaHost.slice(0, -1) : ollamaHost;

  const targetModel = model || "gemma3:4b";
  
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
