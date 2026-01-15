import { NextResponse } from 'next/server';

/**
 * GET /api/ai/models
 * Proxies request to Ollama to get list of installed models.
 * Handles custom endpoints (e.g. Ngrok) provided via headers for Vercel deployment.
 */
export async function GET(request: Request) {
  // 1. Get the custom endpoint from headers
  const ollamaEndpoint = request.headers.get('x-ollama-endpoint') || 'http://localhost:11434';
  
  console.log(`[Vercel API] Proxying models request to: ${ollamaEndpoint}/api/tags`);

  try {
    // 2. Fetch from Ollama with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s for external tunnels

    const response = await fetch(`${ollamaEndpoint}/api/tags`, {
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
        hint: 'Ensure your Ngrok/tunnel is running and the URL is correct.'
      },
      { status: 503 }
    );
  }
}

