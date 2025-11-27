import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  getClientIP,
  RATE_LIMITS,
  rateLimitExceededResponse,
} from '@/utils/rateLimit';

/**
 * PATCH /api/calls/[id]/conversation
 * 
 * Actualiza el elevenlabs_conversation_id de una llamada.
 * Esto es crítico para correlacionar el webhook de ElevenLabs.
 * 
 * Body: { conversationId: string }
 * 
 * Response:
 * - 200: { success: true }
 * - 400/404: { success: false, error: string }
 */

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIP = getClientIP(request.headers);
  const { id: callId } = await params;

  // 1. Rate limiting
  const rateLimitResult = checkRateLimit(
    `call-update:${clientIP}`,
    RATE_LIMITS.CALL_START
  );

  if (!rateLimitResult.allowed) {
    return rateLimitExceededResponse(rateLimitResult);
  }

  try {
    // 2. Parsear body
    const body = await request.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId no proporcionado' },
        { status: 400 }
      );
    }

    // 3. Verificar que la llamada existe
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, status')
      .eq('id', callId)
      .single();

    if (callError || !call) {
      return NextResponse.json(
        { success: false, error: 'Llamada no encontrada' },
        { status: 404 }
      );
    }

    // 4. Actualizar conversation_id
    const { error: updateError } = await supabase
      .from('calls')
      .update({ elevenlabs_conversation_id: conversationId })
      .eq('id', callId);

    if (updateError) {
      console.error('[CallConversation] Error actualizando:', updateError);
      return NextResponse.json(
        { success: false, error: 'Error al actualizar' },
        { status: 500 }
      );
    }

    console.log(`[CallConversation] conversation_id guardado para call ${callId}: ${conversationId}`);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[CallConversation] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}