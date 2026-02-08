import { NextResponse } from 'next/server';

const SESSION_REQUEST_URL = 'https://api.x.ai/v1/realtime/client_secrets';

export async function POST() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing XAI_API_KEY' }, { status: 500 });
  }

  try {
    const r = await fetch(SESSION_REQUEST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expires_after: { seconds: 300 } }),
    });

    if (!r.ok) {
      const errorText = await r.text();
      return NextResponse.json(
        { error: 'Failed to create session', details: errorText },
        { status: r.status }
      );
    }

    const data = await r.json();

    return NextResponse.json({
      client_secret: {
        value: data.value,
        expires_at: data.expires_at,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create client secret' }, { status: 500 });
  }
}
