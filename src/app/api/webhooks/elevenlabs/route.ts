import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Cliente Supabase con service role para operaciones del servidor
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const WEBHOOK_SECRET = process.env.WEBHOOK_SHARED_SECRET || '';

/**
 * Verifica la firma del webhook de ElevenLabs
 */
function verifySignature(payload: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET || !signature) {
    console.warn('[Webhook] No hay secreto o firma para verificar');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (err) {
    console.error('[Webhook] Error verificando firma:', err);
    return false;
  }
}

/**
 * POST /api/webhooks/elevenlabs
 * Recibe la transcripción de ElevenLabs al finalizar una llamada
 */
export async function POST(request: NextRequest) {
  console.log('[Webhook] Recibido webhook de ElevenLabs');

  try {
    // 1. Obtener body raw para verificación
    const rawBody = await request.text();
    const signature = request.headers.get('x-elevenlabs-signature') 
                   || request.headers.get('x-signature');

    // 2. Verificar firma (en producción)
    if (WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
      console.error('[Webhook] Firma inválida');
      return NextResponse.json(
        { error: 'Firma inválida' },
        { status: 401 }
      );
    }

    // 3. Parsear body
    const body = JSON.parse(rawBody);
    console.log('[Webhook] Body recibido:', JSON.stringify(body, null, 2));

    // 4. Extraer datos del webhook
    // La estructura puede variar según la config de ElevenLabs
    const {
      conversation_id,
      transcript,
      messages,
      metadata,
      status,
    } = body;

    // Obtener callId de metadata o conversation_id
    const callId = metadata?.callId || conversation_id;

    if (!callId) {
      console.error('[Webhook] No se encontró callId');
      return NextResponse.json(
        { error: 'callId no proporcionado' },
        { status: 400 }
      );
    }

    console.log('[Webhook] Procesando callId:', callId);

    // 5. Construir contenido de transcripción
    let transcriptContent = '';

    if (transcript) {
      // Si viene como string directo
      transcriptContent = typeof transcript === 'string' 
        ? transcript 
        : JSON.stringify(transcript);
    } else if (messages && Array.isArray(messages)) {
      // Si viene como array de mensajes
      transcriptContent = messages
        .map((msg: any) => `${msg.role || msg.source}: ${msg.content || msg.message}`)
        .join('\n');
    }

    // 6. Verificar que la llamada existe
    const { data: callData, error: callError } = await supabase
      .from('calls')
      .select('id, status')
      .eq('id', callId)
      .single();

    if (callError || !callData) {
      console.error('[Webhook] Llamada no encontrada:', callId);
      return NextResponse.json(
        { error: 'Llamada no encontrada' },
        { status: 404 }
      );
    }

    // 7. Guardar transcripción
    const { error: transcriptError } = await supabase
      .from('transcripts')
      .upsert({
        call_id: callId,
        content: transcriptContent,
        metadata: {
          conversation_id,
          status,
          received_at: new Date().toISOString(),
          raw_messages: messages,
        },
      }, {
        onConflict: 'call_id',
      });

    if (transcriptError) {
      console.error('[Webhook] Error guardando transcripción:', transcriptError);
      throw transcriptError;
    }

    console.log('[Webhook] Transcripción guardada para callId:', callId);

    // 8. Actualizar estado de la llamada si no está completada
    if (callData.status !== 'completed') {
      const { error: updateError } = await supabase
        .from('calls')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', callId);

      if (updateError) {
        console.error('[Webhook] Error actualizando llamada:', updateError);
      } else {
        console.log('[Webhook] Llamada marcada como completada');
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Transcripción guardada correctamente',
      callId,
    });

  } catch (err: any) {
    console.error('[Webhook] Error procesando webhook:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * GET para verificar que el endpoint está activo
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/elevenlabs',
    timestamp: new Date().toISOString(),
  });
}