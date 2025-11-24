import { NextRequest, NextResponse } from 'next/server';

// Configuración del runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('[API] ========================================');
  console.log('[API] GET /api/elevenlabs/session - REQUEST RECEIVED');
  console.log('[API] ========================================');
  
  try {
    const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;

    console.log('[API] Environment variables check:');
    console.log('[API] - Agent ID exists:', !!agentId);
    console.log('[API] - Agent ID value:', agentId ? `${agentId.substring(0, 15)}...` : 'MISSING');
    console.log('[API] - API Key exists:', !!apiKey);
    console.log('[API] - API Key length:', apiKey?.length || 0);
    console.log('[API] - API Key format:', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');

    if (!agentId) {
      console.error('[API] ❌ Agent ID no configurado');
      return NextResponse.json(
        { error: 'Agent ID no configurado en variables de entorno' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      console.error('[API] ❌ API Key no configurada');
      return NextResponse.json(
        { error: 'API Key no configurada en variables de entorno' },
        { status: 400 }
      );
    }

    // Validar formato básico de API Key
    if (apiKey.length < 30) {
      console.error('[API] ❌ API Key parece inválida (muy corta)');
      return NextResponse.json(
        { error: 'API Key tiene formato inválido. Verifica tu ELEVENLABS_API_KEY en .env.local' },
        { status: 400 }
      );
    }

    console.log('[API] ✅ Variables de entorno OK');
    console.log('[ElevenLabs] Llamando a API de ElevenLabs...');

    const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`;
    console.log('[ElevenLabs] URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[ElevenLabs] ❌ Error de API:', response.status, error);
      
      // Mensaje específico para 401
      if (response.status === 401) {
        console.error('[ElevenLabs] ❌ API KEY INVÁLIDA - Verifica tu ELEVENLABS_API_KEY');
        return NextResponse.json(
          { 
            error: `ElevenLabs error: ${response.status}`, 
            detail: error,
            message: 'API Key inválida. Obtén una nueva en https://elevenlabs.io/app/settings/api-keys'
          },
          { status: response.status }
        );
      }
      
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
  console.log('[API] OPTIONS /api/elevenlabs/session - PREFLIGHT REQUEST');
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}