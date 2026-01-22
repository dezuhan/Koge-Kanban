// app/api/ai/generate/route.ts
// Edge Runtime for streaming AI responses - no 10s timeout!

export const runtime = 'edge';

const DEFAULT_OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

const normalizeHost = (host: string) => {
  if (!host) return '';
  let h = host.trim();
  if (!h.startsWith('http://') && !h.startsWith('https://')) h = `http://${h}`;
  const protocolPart = h.startsWith('https') ? 8 : 7;
  if (!h.slice(protocolPart).includes(':')) {
    const hostname = h.slice(protocolPart).split('/')[0];
    if (['localhost','127.0.0.1','0.0.0.0','host.docker.internal'].includes(hostname)) {
      h = h.replace(hostname, `${hostname}:11434`);
    }
  }
  return h.endsWith('/') ? h.slice(0, -1) : h;
};

const getOllamaHost = (req: Request) => {
  const endpoint = req.headers.get('x-ollama-endpoint') || DEFAULT_OLLAMA_HOST;
  return normalizeHost(endpoint);
};

export async function POST(req: Request) {
  try {
    const { prompt, model, options } = await req.json();
    const ollamaHost = getOllamaHost(req);
    const targetModel = model || 'gemma3:4b';

    const requestBody = {
      model: targetModel,
      prompt: prompt,
      stream: true
    };

    if (options) {
      Object.assign(requestBody, { options });
    }

    const ollamaRes = await fetch(`${ollamaHost}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!ollamaRes.ok) {
      const errorText = await ollamaRes.text();
      return new Response(
        JSON.stringify({
          error: `Ollama error: ${ollamaRes.statusText}`,
          details: errorText
        }),
        { status: ollamaRes.status }
      );
    }

    // Stream response back to client
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = ollamaRes.body?.getReader();
          if (!reader) throw new Error('No response body');

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const json = JSON.parse(line);
                  controller.enqueue(
                    new TextEncoder().encode(
                      `data: ${JSON.stringify({
                        response: json.response,
                        done: json.done
                      })}\n\n`
                    )
                  );
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }

          // Send final close signal
          controller.enqueue(
            new TextEncoder().encode('data: {"done": true}\n\n')
          );
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('AI Generate Error:', error);
    return new Response(
      JSON.stringify({
        error: `Failed to connect to Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`
      }),
      { status: 500 }
    );
  }
}
