export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, model, options } = req.body;
  const ollamaHost = req.headers['x-ollama-endpoint'] || 'http://127.0.0.1:11434';
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

    const ollamaRes = await fetch(`${ollamaHost}/api/chat`, {
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

