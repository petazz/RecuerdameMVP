import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase con service role
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/webhooks/elevenlabs/test
 * Endpoint de verificación para probar la conexión con Supabase
 */
export async function GET() {
  console.log('[Test] Verificando conexión con Supabase...');

  try {
    // 1. Verificar variables de entorno
    const envCheck = {
      SUPABASE_URL: !!process.env.SUPABASE_URL || !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      WEBHOOK_SHARED_SECRET: !!process.env.WEBHOOK_SHARED_SECRET,
    };

    console.log('[Test] Variables de entorno:', envCheck);

    // 2. Intentar consultar las últimas llamadas
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select('id, elevenlabs_conversation_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (callsError) {
      throw new Error(`Error consultando calls: ${callsError.message}`);
    }

    // 3. Intentar consultar las transcripciones
    const { data: transcripts, error: transcriptsError } = await supabase
      .from('transcripts')
      .select('id, call_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (transcriptsError) {
      throw new Error(`Error consultando transcripts: ${transcriptsError.message}`);
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Conexión con Supabase exitosa',
      timestamp: new Date().toISOString(),
      environment: envCheck,
      data: {
        recent_calls: calls,
        recent_transcripts: transcripts,
      },
    });

  } catch (error: any) {
    console.error('[Test] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/elevenlabs/test
 * Simular un webhook de ElevenLabs para testing
 */
export async function POST(request: NextRequest) {
  console.log('[Test] Simulando webhook de ElevenLabs...');

  try {
    const body = await request.json();

    // Obtener el conversation_id del body o generar uno de prueba
    const conversationId = body.conversation_id || 'test-conversation-' + Date.now();

    console.log('[Test] Conversation ID:', conversationId);

    // Buscar la llamada
    const { data: callData, error: callError } = await supabase
      .from('calls')
      .select('id, status, elevenlabs_conversation_id')
      .eq('elevenlabs_conversation_id', conversationId)
      .single();

    if (callError || !callData) {
      // Si no existe, buscar las últimas 5 llamadas para ayudar al debugging
      const { data: recentCalls } = await supabase
        .from('calls')
        .select('id, elevenlabs_conversation_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      return NextResponse.json({
        success: false,
        message: 'Llamada no encontrada',
        conversation_id: conversationId,
        suggestion: 'Usa uno de estos conversation_id existentes:',
        recent_calls: recentCalls,
      });
    }

    // Crear transcripción de prueba
    const transcriptContent = body.transcript || 'Transcripción de prueba generada el ' + new Date().toISOString();

    const { data: transcriptData, error: transcriptError } = await supabase
      .from('transcripts')
      .upsert({
        call_id: callData.id,
        content: transcriptContent,
        metadata: {
          conversation_id: conversationId,
          test_mode: true,
          created_at: new Date().toISOString(),
        },
      }, {
        onConflict: 'call_id',
      })
      .select();

    if (transcriptError) {
      throw new Error(`Error guardando transcripción: ${transcriptError.message}`);
    }

    // Actualizar llamada a completada
    await supabase
      .from('calls')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', callData.id);

    return NextResponse.json({
      success: true,
      message: 'Transcripción de prueba guardada',
      call_id: callData.id,
      conversation_id: conversationId,
      transcript: transcriptData,
    });

  } catch (error: any) {
    console.error('[Test] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
