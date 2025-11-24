import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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

    console.log('[ElevenLabs] Obteniendo signed URL para agent:', agentId);

    // ✅ Endpoint correcto con query params
    const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[ElevenLabs] Error:', response.status, error);
      return NextResponse.json(
        { error: `ElevenLabs error: ${response.status}`, detail: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[ElevenLabs] Signed URL obtenida exitosamente');
    console.log('[ElevenLabs] Response:', data);
    
    // ✅ Retornar con headers CORS
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error) {
    console.error('[ElevenLabs] Error obteniendo signed URL:', error);
    return NextResponse.json(
      { error: 'Error obteniendo signed URL' },
      { status: 500 }
    );
  }
}

// ✅ Manejar preflight requests (CORS)
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

export const runtime = 'nodejs';