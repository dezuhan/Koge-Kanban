export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, model, options } = req.body;
  
  // LOGIC FIX: Restore hybrid mode support
  // If server admin set OLLAMA_HOST, use it.
  // Otherwise, allow client to specify their tunnel (Hybrid Mode).
  // If neither, fallback to localhost.
  const serverHost = process.env.OLLAMA_HOST;
  const clientHost = req.headers['x-ollama-endpoint'];
  
  let ollamaHost = serverHost || clientHost || 'http://127.0.0.1:11434';
  
  // Basic URL validation
  if (!ollamaHost.startsWith('http')) {
      ollamaHost = 'http://127.0.0.1:11434';
  }
  
  const cleanHost = ollamaHost.endsWith('/') ? ollamaHost.slice(0, -1) : ollamaHost;

  const targetModel = model || "gemma3:4b";
  
  try {
    const requestBody = {
      model: targetModel,
      messages: messages,
      stream: false
    };

    if (options) {
      requestBody.options = options;
    }

    const ollamaRes = await fetch(`${cleanHost}/api/chat`, {
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
    res.status(200).json({ message: data.message });

  } catch (error) {
    console.error("Vercel AI Chat Proxy Error:", error.message);
    res.status(500).json({ error: `Gagal menghubungi Ollama: ${error.message}` });
  }
}
