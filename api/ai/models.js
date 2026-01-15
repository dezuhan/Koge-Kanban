export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ollamaHost = req.headers['x-ollama-endpoint'] || 'http://127.0.0.1:11434';
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${ollamaHost}/api/tags`, { 
      signal: controller.signal 
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error("Failed to fetch models from Ollama");
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("Vercel AI Models Proxy Error:", error);
    res.status(503).json({ error: "Ollama service unreachable", details: error.message });
  }
}

