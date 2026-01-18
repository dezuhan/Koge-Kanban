import { NextResponse } from 'next/server';

/**
 * GET /api/ai/models
 * Proxies request to Ollama to get list of installed models.
 */
export async function GET(request: Request) {
  // LOGIC FIX: Restore hybrid mode support
  const serverHost = process.env.OLLAMA_HOST;
  const clientHost = request.headers.get('x-ollama-endpoint');
  
  let ollamaEndpoint = serverHost || clientHost || 'http://localhost:11434';
  
  if (!ollamaEndpoint.startsWith('http')) {
      ollamaEndpoint = 'http://localhost:11434';
  }

  const cleanEndpoint = ollamaEndpoint.endsWith('/') ? ollamaEndpoint.slice(0, -1) : ollamaEndpoint;
  
  console.log(`[Vercel API] Proxying models request to: ${cleanEndpoint}/api/tags`);

  try {
    // 2. Fetch from Ollama with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(`${cleanEndpoint}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // 3. Handle Ollama error responses
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Ollama error: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    // 4. Return exactly what Ollama sent
    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("[Vercel API] Connection failed:", error.message);
    
    // 5. Handle connection/timeout errors
    return NextResponse.json(
      { 
        error: 'Ollama service unreachable', 
        details: error.message,
      },
      { status: 503 }
    );
  }
}
