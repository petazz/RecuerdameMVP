import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

export async function POST(request: NextRequest) {
  console.log('[ElevenLabs Session] Iniciando solicitud de signed URL');

  try {
    if (!ELEVENLABS_API_KEY) {
      console.error('[ElevenLabs Session] ELEVENLABS_API_KEY no configurada');
      return NextResponse.json(
        { error: 'Configuración de ElevenLabs incompleta' },
        { status: 500 }
      );
    }

    if (!ELEVENLABS_AGENT_ID) {
      console.error('[ElevenLabs Session] ELEVENLABS_AGENT_ID no configurado');
      return NextResponse.json(
        { error: 'Agent ID no configurado' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { callId } = body;

    if (!callId) {
      return NextResponse.json(
        { error: 'callId es requerido' },
        { status: 400 }
      );
    }

    console.log('[ElevenLabs Session] Solicitando signed URL para callId:', callId);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ElevenLabs Session] Error de API:', response.status, errorText);
      return NextResponse.json(
        { error: `Error de ElevenLabs: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[ElevenLabs Session] Signed URL obtenida correctamente');

    return NextResponse.json({
      signedUrl: data.signed_url,
      callId,
      agentId: ELEVENLABS_AGENT_ID,
    });

  } catch (error: any) {
    console.error('[ElevenLabs Session] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}