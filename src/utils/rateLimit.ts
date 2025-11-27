/**
 * Rate Limiter simple en memoria para MVP
 * 
 * Para producción se recomienda usar Redis (ej: @upstash/ratelimit)
 * pero para el MVP esto es suficiente.
 * 
 * NOTA: En entornos serverless (Vercel), cada instancia tiene su propia memoria,
 * por lo que el rate limiting no es 100% efectivo. Para producción usar Redis.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Almacén en memoria para rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Limpiar entradas expiradas cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Número máximo de requests permitidos */
  maxRequests: number;
  /** Ventana de tiempo en segundos */
  windowSeconds: number;
}

export interface RateLimitResult {
  /** Si el request está permitido */
  allowed: boolean;
  /** Requests restantes en la ventana actual */
  remaining: number;
  /** Timestamp (ms) cuando se reinicia el límite */
  resetTime: number;
  /** Segundos hasta que se reinicie */
  retryAfter: number;
}

/**
 * Verifica si un identificador (IP, token, etc.) ha excedido el rate limit
 * 
 * @param identifier - Identificador único (IP, userId, token, etc.)
 * @param config - Configuración del rate limit
 * @returns Resultado del rate limiting
 * 
 * @example
 * const result = checkRateLimit(clientIP, { maxRequests: 10, windowSeconds: 60 });
 * if (!result.allowed) {
 *   return new Response('Too Many Requests', { status: 429 });
 * }
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const key = identifier;

  let entry = rateLimitStore.get(key);

  // Si no existe entrada o ha expirado, crear nueva
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, entry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: entry.resetTime,
      retryAfter: 0,
    };
  }

  // Incrementar contador
  entry.count++;
  rateLimitStore.set(key, entry);

  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const retryAfter = allowed ? 0 : Math.ceil((entry.resetTime - now) / 1000);

  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
    retryAfter,
  };
}

/**
 * Extrae la IP del cliente de los headers de Next.js
 * Soporta headers de proxies comunes (Vercel, Cloudflare, nginx)
 * 
 * @param headers - Headers del request
 * @returns IP del cliente o 'unknown'
 */
export function getClientIP(headers: Headers): string {
  // Orden de prioridad para obtener la IP real
  const headerNames = [
    'x-real-ip',
    'x-forwarded-for',
    'cf-connecting-ip', // Cloudflare
    'x-vercel-forwarded-for', // Vercel
  ];

  for (const header of headerNames) {
    const value = headers.get(header);
    if (value) {
      // x-forwarded-for puede tener múltiples IPs, tomar la primera
      const ip = value.split(',')[0].trim();
      if (ip) return ip;
    }
  }

  return 'unknown';
}

/**
 * Configuraciones predefinidas de rate limiting
 */
export const RATE_LIMITS = {
  /** Rutas públicas: 30 requests por minuto por IP */
  PUBLIC: {
    maxRequests: 30,
    windowSeconds: 60,
  },
  /** Validación de token: 10 requests por minuto por IP */
  TOKEN_VALIDATION: {
    maxRequests: 10,
    windowSeconds: 60,
  },
  /** Inicio de llamada: 5 requests por minuto por IP */
  CALL_START: {
    maxRequests: 5,
    windowSeconds: 60,
  },
  /** Webhooks: 100 requests por minuto (más permisivo) */
  WEBHOOK: {
    maxRequests: 100,
    windowSeconds: 60,
  },
} as const;

/**
 * Helper para crear respuesta de rate limit excedido
 */
export function rateLimitExceededResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Demasiadas solicitudes. Por favor, espera un momento.',
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': result.retryAfter.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toString(),
      },
    }
  );
}