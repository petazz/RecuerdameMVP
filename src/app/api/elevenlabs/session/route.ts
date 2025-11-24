import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID no configurado' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key no configurada' },
        { status: 400 }
      );
    }

    // Obtener parámetros del body
    const body = await request.json();
    const { callId, userId, userName } = body;

    console.log('[ElevenLabs] Obteniendo signed URL para agent:', agentId);
    console.log('[ElevenLabs] CallId:', callId, 'UserId:', userId, 'UserName:', userName);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}/signed-url`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[ElevenLabs] Error:', response.status, error);
      return NextResponse.json(
        { error: `ElevenLabs error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[ElevenLabs] Signed URL obtenida exitosamente');

    return NextResponse.json(data);
  } catch (error) {
    console.error('[ElevenLabs] Error obteniendo signed URL:', error);
    return NextResponse.json(
      { error: 'Error obteniendo signed URL' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';