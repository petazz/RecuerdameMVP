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
    // OPCIÓN 1: Comparación directa (más común en ElevenLabs)
    if (signature === WEBHOOK_SECRET) {
      console.log('[Webhook] ✅ Firma verificada (comparación directa)');
      return true;
    }

    // OPCIÓN 2: Intentar con HMAC SHA256 (por si acaso)
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    if (signature === expectedSignature || signature === `sha256=${expectedSignature}`) {
      console.log('[Webhook] ✅ Firma verificada (HMAC SHA256)');
      return true;
    }

    console.warn('[Webhook] ❌ Firma no coincide con ningún método');
    return false;

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
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔔 [Webhook] WEBHOOK RECIBIDO DE ELEVENLABS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[Webhook] Timestamp:', new Date().toISOString());

  try {
    // 1. Obtener body raw para verificación
    const rawBody = await request.text();
    
    console.log('[Webhook] 📦 Raw body length:', rawBody.length, 'bytes');
    
    // Log de headers para debugging
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('[Webhook] 📋 Headers recibidos:');
    console.log(JSON.stringify(headers, null, 2));

    // 2. Verificar firma (buscar en varios headers posibles)
const signature = request.headers.get('elevenlabs-signature')      // ← NUEVO: sin x-
               || request.headers.get('x-elevenlabs-signature')   
               || request.headers.get('x-signature')
               || request.headers.get('x-webhook-signature');

    console.log('[Webhook] 🔐 Signature presente:', !!signature);
    console.log('[Webhook] 🔐 Webhook secret configurado:', !!WEBHOOK_SECRET);

    if (WEBHOOK_SECRET && !verifyWebhookSignature(rawBody, signature)) {
      console.error('[Webhook] ❌ Firma inválida');
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
      console.error('[Webhook] ❌ Error parseando JSON:', parseError);
      console.error('[Webhook] Raw body:', rawBody);
      return NextResponse.json(
        { error: 'JSON inválido' },
        { status: 400 }
      );
    }

    console.log('[Webhook] 📄 Tipo de evento:', body.type);
    console.log('[Webhook] 📄 Payload completo:');
    console.log(JSON.stringify(body, null, 2));

    // 4. Extraer conversation_id de ElevenLabs
    const conversationId = body.conversation_id;

    if (!conversationId) {
      console.error('[Webhook] ❌ No se encontró conversation_id en el payload');
      console.error('[Webhook] Keys disponibles en body:', Object.keys(body));
      return NextResponse.json(
        { error: 'conversation_id no proporcionado' },
        { status: 400 }
      );
    }

    console.log('[Webhook] 🔑 Conversation ID recibido:', conversationId);
    console.log('[Webhook] 🔍 Buscando en BD con conversation_id:', conversationId);

    console.log('[Webhook] 🔑 Conversation ID recibido:', conversationId);
    console.log('[Webhook] 🔍 Buscando en BD con conversation_id:', conversationId);

    // 5. Buscar la llamada por elevenlabs_conversation_id
    const { data: callData, error: callError } = await supabase
      .from('calls')
      .select('id, status, user_id, center_id, elevenlabs_conversation_id')
      .eq('elevenlabs_conversation_id', conversationId)
      .single();

    if (callError || !callData) {
      console.error('[Webhook] ❌ Llamada NO encontrada para conversation_id:', conversationId);
      console.error('[Webhook] Error de Supabase:', callError);
      
      // Buscar todas las llamadas recientes para debugging
      const { data: recentCalls } = await supabase
        .from('calls')
        .select('id, elevenlabs_conversation_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.error('[Webhook] 📋 Últimas 5 llamadas en BD:');
      console.error(JSON.stringify(recentCalls, null, 2));
      
      // Devolver 200 para que ElevenLabs no reintente
      // pero loguear el error para investigación
      return NextResponse.json({
        success: false,
        message: 'Llamada no encontrada - conversation_id no correlacionado',
        conversation_id: conversationId,
        recent_calls: recentCalls,
      });
    }

    console.log('[Webhook] ✅ Llamada encontrada:', callData.id);
    console.log('[Webhook] 📋 Datos de la llamada:', JSON.stringify(callData, null, 2));

    // 6. Extraer y formatear la transcripción
    const transcriptContent = extractTranscriptText(body.transcript);
    
    console.log('[Webhook] 📝 Longitud de transcripción:', transcriptContent.length, 'caracteres');
    console.log('[Webhook] 📝 Preview de transcripción:', transcriptContent.substring(0, 200) + '...');

    // 7. Guardar transcripción (upsert por si ya existe)
    console.log('[Webhook] 💾 Guardando transcripción en BD...');
    
    const { data: transcriptData, error: transcriptError } = await supabase
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
      })
      .select();

    if (transcriptError) {
      console.error('[Webhook] ❌ Error guardando transcripción:', transcriptError);
      console.error('[Webhook] Error completo:', JSON.stringify(transcriptError, null, 2));
      throw transcriptError;
    }

    console.log('[Webhook] ✅ Transcripción guardada correctamente');
    console.log('[Webhook] 📋 Datos guardados:', JSON.stringify(transcriptData, null, 2));

    // 8. Actualizar estado de la llamada si no está completada
    if (callData.status !== 'completed') {
      console.log('[Webhook] 🔄 Actualizando estado de llamada a "completed"...');
      
      const { error: updateError } = await supabase
        .from('calls')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', callData.id);

      if (updateError) {
        console.error('[Webhook] ❌ Error actualizando estado de llamada:', updateError);
      } else {
        console.log('[Webhook] ✅ Llamada marcada como completada');
      }
    }

    const processingTime = Date.now() - startTime;
    console.log('[Webhook] ⏱️  Procesamiento completado en', processingTime, 'ms');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    return NextResponse.json({
      success: true,
      message: 'Transcripción guardada correctamente',
      call_id: callData.id,
      conversation_id: conversationId,
      processing_time_ms: processingTime,
    });

  } catch (err: any) {
    console.error('[Webhook] ❌❌❌ ERROR PROCESANDO WEBHOOK ❌❌❌');
    console.error('[Webhook] Error:', err);
    console.error('[Webhook] Stack:', err.stack);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
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