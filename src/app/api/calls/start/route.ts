import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  getClientIP,
  RATE_LIMITS,
  rateLimitExceededResponse,
} from '@/utils/rateLimit';

/**
 * POST /api/calls/start
 * 
 * Inicia una nueva llamada para un usuario.
 * Valida el token, verifica límite diario y crea el registro.
 * 
 * Body: { loginToken: string }
 * 
 * Response:
 * - 200: { success: true, callId: string, canStart: true }
 * - 200: { success: false, error: string, canStart: false }
 * - 429: Rate limit exceeded
 */

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request.headers);

  // 1. Rate limiting estricto para inicio de llamadas
  const rateLimitResult = checkRateLimit(
    `call-start:${clientIP}`,
    RATE_LIMITS.CALL_START
  );

  if (!rateLimitResult.allowed) {
    console.log(`[CallStart] Rate limit excedido para IP: ${clientIP}`);
    return rateLimitExceededResponse(rateLimitResult);
  }

  try {
    // 2. Parsear body
    const body = await request.json();
    const { loginToken } = body;

    if (!loginToken) {
      return NextResponse.json(
        { success: false, error: 'Token no proporcionado', canStart: false },
        { status: 400 }
      );
    }

    // 3. Validar usuario
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, full_name, center_id, centers(timezone)')
      .eq('login_token', loginToken)
      .single();

    if (userError || !user) {
      // Mensaje genérico por seguridad
      return NextResponse.json(
        { success: false, error: 'No se pudo iniciar la llamada', canStart: false },
        { status: 400 }
      );
    }

    // 4. Verificar límite diario
    const timezone = (user.centers as any)?.timezone || 'Europe/Madrid';
    const callsToday = await countCallsToday(user.id, timezone);

    if (callsToday >= 2) {
      return NextResponse.json({
        success: false,
        error: 'Has alcanzado el límite de 2 llamadas por día',
        canStart: false,
        callsToday,
      });
    }

    // 5. Crear registro de llamada
    const { data: callData, error: callError } = await supabase
      .from('calls')
      .insert([{
        user_id: user.id,
        center_id: user.center_id,
        started_at: new Date().toISOString(),
        status: 'started',
      }])
      .select()
      .single();

    if (callError) {
      console.error('[CallStart] Error creando llamada:', callError);
      return NextResponse.json(
        { success: false, error: 'Error al iniciar la llamada', canStart: false },
        { status: 500 }
      );
    }

    console.log(`[CallStart] Llamada iniciada: ${callData.id} para usuario: ${user.id}`);

    // 6. Respuesta exitosa
    return NextResponse.json({
      success: true,
      callId: callData.id,
      canStart: true,
      callsToday: callsToday + 1,
      userName: user.full_name,
    });

  } catch (error: any) {
    console.error('[CallStart] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', canStart: false },
      { status: 500 }
    );
  }
}

/**
 * Cuenta las llamadas del usuario en el día actual según timezone
 */
async function countCallsToday(userId: string, timezone: string): Promise<number> {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = formatter.format(now);
    const startOfDayLocal = new Date(`${todayStr}T00:00:00`);
    
    const tempDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offsetMs = utcDate.getTime() - tempDate.getTime();
    const startOfDayUTC = new Date(startOfDayLocal.getTime() + offsetMs);

    const { data, error } = await supabase
      .from('calls')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .in('status', ['started', 'completed'])
      .gte('started_at', startOfDayUTC.toISOString());

    if (error) {
      console.error('[CallStart] Error contando llamadas:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('[CallStart] Error en countCallsToday:', error);
    return 0;
  }
}