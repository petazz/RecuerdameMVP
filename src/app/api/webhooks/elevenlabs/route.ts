import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * Webhook de ElevenLabs
 * 
 * Este endpoint recibe las transcripciones de las conversaciones
 * cuando finalizan en ElevenLabs.
 * 
 * CORRELACIÓN:
 * ElevenLabs envía un 'conversation_id' único que guardamos
 * en nuestra tabla 'calls' como 'elevenlabs_conversation_id'
 * cuando se inicia la llamada.
 * 
 * Estructura del payload de ElevenLabs (ejemplo):
 * {
 *   "type": "post_conversation_evaluation",
 *   "conversation_id": "abc123",
 *   "agent_id": "xyz789",
 *   "status": "done",
 *   "transcript": [...],
 *   "metadata": {...},
 *   "analysis": {...}
 * }
 */

// Cliente Supabase con service role para operaciones del servidor
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const WEBHOOK_SECRET = process.env.WEBHOOK_SHARED_SECRET || '';

/**
 * Verifica la firma del webhook de ElevenLabs
 * ElevenLabs puede usar diferentes métodos de firma
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  // Si no hay secreto configurado, permitir (desarrollo)
  if (!WEBHOOK_SECRET) {
    console.warn('[Webhook] WEBHOOK_SHARED_SECRET no configurado - saltando verificación');
    return true;
  }

  if (!signature) {
    console.warn('[Webhook] No se recibió firma en el request');
    return false;
  }

  try {
    // ElevenLabs puede enviar la firma en diferentes formatos
    // Intentamos verificar con HMAC SHA256
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Comparación segura contra timing attacks
    const sigBuffer = Buffer.from(signature.replace('sha256=', ''), 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (err) {
    console.error('[Webhook] Error verificando firma:', err);
    return false;
  }
}

/**
 * Extrae el texto de la transcripción del formato de ElevenLabs
 */
function extractTranscriptText(transcript: any): string {
  if (!transcript) return '';

  // Si es string directo
  if (typeof transcript === 'string') {
    return transcript;
  }

  // Si es array de mensajes
  if (Array.isArray(transcript)) {
    return transcript
      .map((item: any) => {
        const role = item.role || item.source || 'unknown';
        const content = item.message || item.content || item.text || '';
        return `${role}: ${content}`;
      })
      .join('\n');
  }

  // Otros formatos
  return JSON.stringify(transcript);
}

/**
 * POST /api/webhooks/elevenlabs
 * Recibe la transcripción de ElevenLabs al finalizar una llamada
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[Webhook] ========================================');
  console.log('[Webhook] Recibido webhook de ElevenLabs');

  try {
    // 1. Obtener body raw para verificación
    const rawBody = await request.text();
    
    // Log de headers para debugging
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('[Webhook] Headers recibidos:', JSON.stringify(headers, null, 2));

    // 2. Verificar firma (buscar en varios headers posibles)
    const signature = request.headers.get('x-elevenlabs-signature') 
                   || request.headers.get('x-signature')
                   || request.headers.get('x-webhook-signature');

    if (WEBHOOK_SECRET && !verifyWebhookSignature(rawBody, signature)) {
      console.error('[Webhook] Firma inválida');
      return NextResponse.json(
        { error: 'Firma inválida' },
        { status: 401 }
      );
    }

    // 3. Parsear body
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[Webhook] Error parseando JSON:', parseError);
      return NextResponse.json(
        { error: 'JSON inválido' },
        { status: 400 }
      );
    }

    console.log('[Webhook] Tipo de evento:', body.type);
    console.log('[Webhook] Body recibido:', JSON.stringify(body, null, 2));

    // 4. Extraer conversation_id de ElevenLabs
    const conversationId = body.conversation_id;

    if (!conversationId) {
      console.error('[Webhook] No se encontró conversation_id en el payload');
      return NextResponse.json(
        { error: 'conversation_id no proporcionado' },
        { status: 400 }
      );
    }

    console.log('[Webhook] Buscando llamada con conversation_id:', conversationId);

    // 5. Buscar la llamada por elevenlabs_conversation_id
    const { data: callData, error: callError } = await supabase
      .from('calls')
      .select('id, status, user_id, center_id')
      .eq('elevenlabs_conversation_id', conversationId)
      .single();

    if (callError || !callData) {
      console.error('[Webhook] Llamada no encontrada para conversation_id:', conversationId);
      console.error('[Webhook] Error:', callError);
      
      // Devolver 200 para que ElevenLabs no reintente
      // pero loguear el error para investigación
      return NextResponse.json({
        success: false,
        message: 'Llamada no encontrada - conversation_id no correlacionado',
        conversation_id: conversationId,
      });
    }

    console.log('[Webhook] Llamada encontrada:', callData.id);

    // 6. Extraer y formatear la transcripción
    const transcriptContent = extractTranscriptText(body.transcript);
    
    console.log('[Webhook] Longitud de transcripción:', transcriptContent.length, 'caracteres');

    // 7. Guardar transcripción (upsert por si ya existe)
    const { error: transcriptError } = await supabase
      .from('transcripts')
      .upsert({
        call_id: callData.id,
        content: transcriptContent,
        metadata: {
          conversation_id: conversationId,
          agent_id: body.agent_id,
          status: body.status,
          type: body.type,
          analysis: body.analysis || null,
          received_at: new Date().toISOString(),
        },
      }, {
        onConflict: 'call_id',
      });

    if (transcriptError) {
      console.error('[Webhook] Error guardando transcripción:', transcriptError);
      throw transcriptError;
    }

    console.log('[Webhook] Transcripción guardada correctamente');

    // 8. Actualizar estado de la llamada si no está completada
    if (callData.status !== 'completed') {
      const { error: updateError } = await supabase
        .from('calls')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', callData.id);

      if (updateError) {
        console.error('[Webhook] Error actualizando estado de llamada:', updateError);
      } else {
        console.log('[Webhook] Llamada marcada como completada');
      }
    }

    const processingTime = Date.now() - startTime;
    console.log('[Webhook] Procesamiento completado en', processingTime, 'ms');
    console.log('[Webhook] ========================================');

    return NextResponse.json({
      success: true,
      message: 'Transcripción guardada correctamente',
      call_id: callData.id,
      conversation_id: conversationId,
      processing_time_ms: processingTime,
    });

  } catch (err: any) {
    console.error('[Webhook] Error procesando webhook:', err);
    console.error('[Webhook] Stack:', err.stack);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        message: err.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET para verificar que el endpoint está activo
 * Útil para configurar el webhook en ElevenLabs
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/elevenlabs',
    description: 'Webhook para recibir transcripciones de ElevenLabs',
    timestamp: new Date().toISOString(),
    configured: {
      supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      webhook_secret: !!process.env.WEBHOOK_SHARED_SECRET,
    },
  });
}