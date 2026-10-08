export default {
  async fetch(request, env) {
    // CORS
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    try {
      const { provider, model, messages } = await request.json();
      let url, headers, body;

      if (provider === 'groq') {
        url = 'https://api.groq.com/openai/v1/chat/completions';
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.GROQ_API_KEY}`
        };
        body = JSON.stringify({ model, messages, stream: true, temperature: 0.7 });

      } else if (provider === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${env.GOOGLE_GEMINI_KEY}`;
        headers = { 'Content-Type': 'application/json' };
        const contents = messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
        body = JSON.stringify({ contents, generationConfig: { temperature: 0.7 } });

      } else if (provider === 'openrouter') {
        url = 'https://openrouter.ai/api/v1/chat/completions';
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://omni-ai.workers.dev',
          'X-Title': 'OMNI-AI'
        };
        body = JSON.stringify({ model, messages, stream: true });

      } else {
        return new Response(JSON.stringify({ error: 'Unknown provider' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      const res = await fetch(url, { method: 'POST', headers, body });
      return new Response(res.body, {
        headers: {
          ...cors,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
  }
};
