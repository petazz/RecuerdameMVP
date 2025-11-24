import { NextRequest, NextResponse } from 'next/server';

// ✅ CAMBIO CRÍTICO: De POST a GET
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

    // ✅ CAMBIO CRÍTICO: URL con query params (no body)
    const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`;

    // ✅ CAMBIO CRÍTICO: Método GET, sin body, sin Content-Type
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        // NO incluir Content-Type en GET
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
