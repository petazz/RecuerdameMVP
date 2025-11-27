import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  getClientIP,
  RATE_LIMITS,
  rateLimitExceededResponse,
} from '@/utils/rateLimit';

/**
 * POST /api/calls/end
 * 
 * Finaliza una llamada en curso.
 * Actualiza el registro con ended_at, duration_seconds y status.
 * 
 * Body: { callId: string, elevenlabsConversationId?: string }
 * 
 * Response:
 * - 200: { success: true, duration: number }
 * - 400: { success: false, error: string }
 * - 429: Rate limit exceeded
 */

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request.headers);

  // 1. Rate limiting (usamos el mismo que call start)
  const rateLimitResult = checkRateLimit(
    `call-end:${clientIP}`,
    RATE_LIMITS.CALL_START
  );

  if (!rateLimitResult.allowed) {
    console.log(`[CallEnd] Rate limit excedido para IP: ${clientIP}`);
    return rateLimitExceededResponse(rateLimitResult);
  }

  try {
    // 2. Parsear body
    const body = await request.json();
    const { callId, elevenlabsConversationId } = body;

    if (!callId) {
      return NextResponse.json(
        { success: false, error: 'callId no proporcionado' },
        { status: 400 }
      );
    }

    // 3. Obtener la llamada actual
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, started_at, status')
      .eq('id', callId)
      .single();

    if (callError || !call) {
      console.error('[CallEnd] Llamada no encontrada:', callId);
      return NextResponse.json(
        { success: false, error: 'Llamada no encontrada' },
        { status: 404 }
      );
    }

    // 4. Verificar que la llamada está en curso
    if (call.status !== 'started') {
      return NextResponse.json(
        { success: false, error: 'La llamada ya ha finalizado' },
        { status: 400 }
      );
    }

    // 5. Calcular duración
    const startedAt = new Date(call.started_at);
    const endedAt = new Date();
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

    // 6. Preparar datos de actualización
    const updateData: any = {
      status: 'completed',
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
    };

    // Si se proporciona el conversation_id de ElevenLabs, guardarlo
    if (elevenlabsConversationId) {
      updateData.elevenlabs_conversation_id = elevenlabsConversationId;
    }

    // 7. Actualizar la llamada
    const { error: updateError } = await supabase
      .from('calls')
      .update(updateData)
      .eq('id', callId);

    if (updateError) {
      console.error('[CallEnd] Error actualizando llamada:', updateError);
      return NextResponse.json(
        { success: false, error: 'Error al finalizar la llamada' },
        { status: 500 }
      );
    }

    console.log(`[CallEnd] Llamada finalizada: ${callId}, duración: ${durationSeconds}s`);

    // 8. Respuesta exitosa
    return NextResponse.json({
      success: true,
      callId,
      duration: durationSeconds,
      endedAt: endedAt.toISOString(),
    });

  } catch (error: any) {
    console.error('[CallEnd] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}