import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import {
  checkRateLimit,
  getClientIP,
  RATE_LIMITS,
  rateLimitExceededResponse,
} from '@/utils/rateLimit';

/**
 * Webhook de ElevenLabs
 * 
 * Este endpoint recibe las transcripciones de las conversaciones
 * cuando finalizan en ElevenLabs.
 * 
 * Incluye:
 * - Rate limiting
 * - Verificación de firma
 * - Correlación por conversation_id
 */

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const WEBHOOK_SECRET = process.env.WEBHOOK_SHARED_SECRET || '';

/**
 * Verifica la firma del webhook de ElevenLabs
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('[Webhook] WEBHOOK_SHARED_SECRET no configurado - saltando verificación');
    return true;
  }

  if (!signature) {
    console.warn('[Webhook] No se recibió firma en el request');
    return false;
  }

  try {
    // Formato ElevenLabs con timestamp
    if (signature.includes('t=') && signature.includes('v0=')) {
      const parts = signature.split(',');
      let timestamp = '';
      let signatureHash = '';
      
      for (const part of parts) {
        if (part.startsWith('t=')) {
          timestamp = part.substring(2);
        } else if (part.startsWith('v0=')) {
          signatureHash = part.substring(3);
        }
      }
      
      if (!timestamp || !signatureHash) {
        return false;
      }
      
      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(signedPayload)
        .digest('hex');
      
      if (signatureHash === expectedSignature) {
        return true;
      }
      
      return false;
    }
    
    // Comparación directa
    if (signature === WEBHOOK_SECRET) {
      return true;
    }

    // HMAC SHA256 simple
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    if (signature === expectedSignature || signature === `sha256=${expectedSignature}`) {
      return true;
    }

    return false;

  } catch (err) {
    console.error('[Webhook] Error verificando firma:', err);
    return false;
  }
}

/**
 * Extrae el texto de la transcripción
 */
function extractTranscriptText(transcript: any): string {
  if (!transcript) return '';

  if (typeof transcript === 'string') {
    return transcript;
  }

  if (Array.isArray(transcript)) {
    return transcript
      .map((item: any) => {
        const role = item.role || item.source || 'unknown';
        const content = item.message || item.content || item.text || '';
        return `${role}: ${content}`;
      })
      .join('\n');
  }

  return JSON.stringify(transcript);
}

/**
 * POST /api/webhook/elevenlabs
 */
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request.headers);
  const startTime = Date.now();

  // 1. Rate limiting para webhooks
  const rateLimitResult = checkRateLimit(
    `webhook:${clientIP}`,
    RATE_LIMITS.WEBHOOK
  );

  if (!rateLimitResult.allowed) {
    console.log(`[Webhook] Rate limit excedido para IP: ${clientIP}`);
    return rateLimitExceededResponse(rateLimitResult);
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔔 [Webhook] WEBHOOK RECIBIDO DE ELEVENLABS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const rawBody = await request.text();

    // 2. Verificar firma
    const signature = request.headers.get('elevenlabs-signature')
                   || request.headers.get('x-elevenlabs-signature')
                   || request.headers.get('x-signature')
                   || request.headers.get('x-webhook-signature');

    if (WEBHOOK_SECRET && !verifyWebhookSignature(rawBody, signature)) {
      console.error('[Webhook] ❌ Firma inválida');
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
    }

    // 3. Parsear body
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[Webhook] ❌ Error parseando JSON');
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    console.log('[Webhook] 📄 Tipo de evento:', body.type);

    // 4. Extraer conversation_id
    const conversationId = body.data?.conversation_id || body.conversation_id;

    if (!conversationId) {
      console.error('[Webhook] ❌ No se encontró conversation_id');
      return NextResponse.json(
        { error: 'conversation_id no proporcionado' },
        { status: 400 }
      );
    }

    console.log('[Webhook] 🔑 Conversation ID:', conversationId);

    // 5. Buscar la llamada
    const { data: callData, error: callError } = await supabase
      .from('calls')
      .select('id, status, user_id, center_id')
      .eq('elevenlabs_conversation_id', conversationId)
      .single();

    if (callError || !callData) {
      console.error('[Webhook] ❌ Llamada NO encontrada para:', conversationId);
      
      // Log de debugging
      const { data: recentCalls } = await supabase
        .from('calls')
        .select('id, elevenlabs_conversation_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.error('[Webhook] 📋 Últimas 5 llamadas:', JSON.stringify(recentCalls, null, 2));
      
      return NextResponse.json({
        success: false,
        message: 'Llamada no encontrada',
        conversation_id: conversationId,
      });
    }

    console.log('[Webhook] ✅ Llamada encontrada:', callData.id);

    // 6. Extraer transcripción
    const transcript = body.data?.transcript || body.transcript;
    const transcriptContent = extractTranscriptText(transcript);

    // 7. Guardar transcripción
    const { error: transcriptError } = await supabase
      .from('transcripts')
      .upsert({
        call_id: callData.id,
        content: transcriptContent,
        metadata: {
          conversation_id: conversationId,
          agent_id: body.data?.agent_id || body.agent_id,
          status: body.data?.status || body.status,
          type: body.type,
          analysis: body.data?.analysis || body.analysis || null,
          received_at: new Date().toISOString(),
        },
      }, {
        onConflict: 'call_id',
      });

    if (transcriptError) {
      console.error('[Webhook] ❌ Error guardando transcripción:', transcriptError);
      throw transcriptError;
    }

    console.log('[Webhook] ✅ Transcripción guardada');

    // 8. Actualizar estado si es necesario
    if (callData.status !== 'completed') {
      await supabase
        .from('calls')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', callData.id);

      console.log('[Webhook] ✅ Llamada marcada como completada');
    }

    const processingTime = Date.now() - startTime;
    console.log('[Webhook] ⏱️ Procesamiento:', processingTime, 'ms');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json({
      success: true,
      call_id: callData.id,
      processing_time_ms: processingTime,
    });

  } catch (err: any) {
    console.error('[Webhook] ❌ ERROR:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * GET para verificar el endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhook/elevenlabs',
    timestamp: new Date().toISOString(),
  });
}