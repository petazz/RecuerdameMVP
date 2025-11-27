import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  getClientIP,
  RATE_LIMITS,
  rateLimitExceededResponse,
} from '@/utils/rateLimit';

/**
 * GET /api/public/users/validate?token=...
 * 
 * Valida un token de usuario y devuelve si puede iniciar llamada.
 * Incluye rate limiting para prevenir fuerza bruta.
 * 
 * Response:
 * - 200: { valid: true, canStart: boolean, callsToday: number, userName: string }
 * - 200: { valid: false } (token inválido - NO revelar si existe)
 * - 429: Rate limit exceeded
 */

// Cliente Supabase con service role para operaciones del servidor
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(request: NextRequest) {
  const clientIP = getClientIP(request.headers);
  
  // 1. Aplicar rate limiting
  const rateLimitResult = checkRateLimit(
    `token-validation:${clientIP}`,
    RATE_LIMITS.TOKEN_VALIDATION
  );

  if (!rateLimitResult.allowed) {
    console.log(`[Validate] Rate limit excedido para IP: ${clientIP}`);
    return rateLimitExceededResponse(rateLimitResult);
  }

  try {
    // 2. Obtener token de la query
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      // Respuesta genérica - NO revelar que falta el token
      return NextResponse.json({ valid: false });
    }

    // 3. Buscar usuario por token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, full_name, center_id, centers(timezone)')
      .eq('login_token', token)
      .single();

    if (userError || !user) {
      // Respuesta genérica - NO revelar si el token existe o no
      return NextResponse.json({ valid: false });
    }

    // 4. Calcular llamadas del día según timezone del centro
    const timezone = (user.centers as any)?.timezone || 'Europe/Madrid';
    const callsToday = await countCallsToday(user.id, timezone);
    const canStart = callsToday < 2;

    // 5. Respuesta exitosa
    return NextResponse.json({
      valid: true,
      canStart,
      callsToday,
      userName: user.full_name,
      userId: user.id,
    });

  } catch (error: any) {
    console.error('[Validate] Error:', error);
    // Respuesta genérica ante errores - NO revelar detalles
    return NextResponse.json({ valid: false });
  }
}

/**
 * Cuenta las llamadas del usuario en el día actual según timezone
 */
async function countCallsToday(userId: string, timezone: string): Promise<number> {
  try {
    // Calcular inicio del día en el timezone del centro
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = formatter.format(now);
    
    // Crear fecha de inicio del día en UTC
    const startOfDayLocal = new Date(`${todayStr}T00:00:00`);
    
    // Obtener el offset del timezone para convertir a UTC correctamente
    const tempDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offsetMs = utcDate.getTime() - tempDate.getTime();
    
    const startOfDayUTC = new Date(startOfDayLocal.getTime() + offsetMs);

    // Contar llamadas
    const { data, error } = await supabase
      .from('calls')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .in('status', ['started', 'completed'])
      .gte('started_at', startOfDayUTC.toISOString());

    if (error) {
      console.error('[Validate] Error contando llamadas:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('[Validate] Error en countCallsToday:', error);
    return 0;
  }
}