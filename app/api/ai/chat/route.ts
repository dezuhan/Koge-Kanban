import { NextResponse } from 'next/server';

/**
 * POST /api/ai/chat
 * Proxies chat request to Ollama instance via custom endpoint.
 */
export async function POST(request: Request) {
  const ollamaEndpoint = request.headers.get('x-ollama-endpoint') || 'http://localhost:11434';
  const body = await request.json();

  console.log(`[Vercel API] Proxying chat request to: ${ollamaEndpoint}/api/chat`);

  try {
    const response = await fetch(`${ollamaEndpoint}/api/chat`, {
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
    console.error("[Vercel API] Chat proxy failed:", error.message);
    return NextResponse.json(
      { error: 'Gagal menghubungi Ollama', details: error.message },
      { status: 500 }
    );
  }
}

