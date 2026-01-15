import { NextResponse } from 'next/server';

/**
 * POST /api/ai/generate
 * Proxies generation request to Ollama instance via custom endpoint.
 */
export async function POST(request: Request) {
  const ollamaEndpoint = request.headers.get('x-ollama-endpoint') || 'http://localhost:11434';
  const body = await request.json();

  console.log(`[Vercel API] Proxying generate request to: ${ollamaEndpoint}/api/generate`);

  try {
    const response = await fetch(`${ollamaEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Ollama error: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("[Vercel API] Generate proxy failed:", error.message);
    return NextResponse.json(
      { error: 'Gagal menghubungi Ollama', details: error.message },
      { status: 500 }
    );
  }
}

