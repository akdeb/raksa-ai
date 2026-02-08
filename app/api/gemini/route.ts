import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
  }

  try {
    const client = new GoogleGenAI({ apiKey });

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    return NextResponse.json({
      token: token.name,
      expiresAt: expireTime,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Gemini ephemeral token error:', message);
    return NextResponse.json({ error: 'Failed to create ephemeral token', details: message }, { status: 500 });
  }
}
