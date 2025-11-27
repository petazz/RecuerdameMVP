'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useElevenLabs } from '@/hooks/useElevenLabs';

type CallState = 'ready' | 'connecting' | 'calling' | 'ended' | 'error';

interface UseCallSessionReturn {
  callState: CallState;
  callDuration: number;
  error: string | null;
  canStartCall: boolean;
  callsToday: number;
  isSpeaking: boolean;
  startCall: () => Promise<void>;
  endCall: () => Promise<void>;
  resetCall: () => void;
}

/**
 * Hook para manejar sesiones de llamada con ElevenLabs
 * 
 * Usa los endpoints del backend para:
 * - Rate limiting
 * - Validación centralizada
 * - Creación/actualización de llamadas
 */
export function useCallSession(userId: string, loginToken?: string): UseCallSessionReturn {
  const [callState, setCallState] = useState<CallState>('ready');
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canStartCall, setCanStartCall] = useState(true);
  const [callsToday, setCallsToday] = useState(0);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Hook de ElevenLabs
  const {
    isConnected,
    isConnecting,
    isSpeaking,
    conversationId,
    error: elevenLabsError,
    connect,
    disconnect,
  } = useElevenLabs({
    onError: (err) => {
      console.error('[CallSession] Error de ElevenLabs:', err);
      setError(err);
    },
    onStatusChange: (status) => {
      console.log('[CallSession] Status ElevenLabs:', status);
    },
    onConnect: async (convId) => {
      console.log('[CallSession] Conectado con conversation_id:', convId);
      // Guardar conversation_id en el backend
      if (currentCallId && convId) {
        await updateCallWithConversationId(currentCallId, convId);
      }
    },
    onDisconnect: () => {
      console.log('[CallSession] Desconectado de ElevenLabs');
    },
  });

  // Verificar límite diario al montar
  useEffect(() => {
    if (loginToken) {
      checkDailyLimit();
    }
  }, [userId, loginToken]);

  // Sincronizar estado de conexión
  useEffect(() => {
    if (isConnecting) {
      setCallState('connecting');
    } else if (isConnected) {
      setCallState('calling');
    }
  }, [isConnected, isConnecting]);

  // Sincronizar errores
  useEffect(() => {
    if (elevenLabsError) {
      setError(elevenLabsError);
    }
  }, [elevenLabsError]);

  /**
   * Actualiza el conversation_id usando el endpoint del backend
   */
  const updateCallWithConversationId = async (callId: string, convId: string) => {
    try {
      console.log('[CallSession] 🔑 Guardando conversation_id...');
      
      const response = await fetch(`/api/calls/${callId}/conversation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId }),
      });

      if (!response.ok) {
        console.error('[CallSession] Error guardando conversation_id');
      } else {
        console.log('[CallSession] ✅ conversation_id guardado');
      }
    } catch (err) {
      console.error('[CallSession] Error:', err);
    }
  };

  /**
   * Verifica el límite diario usando el endpoint del backend
   */
  const checkDailyLimit = async () => {
    if (!loginToken) return;

    try {
      const response = await fetch(`/api/public/users/validate?token=${encodeURIComponent(loginToken)}`);
      
      if (response.status === 429) {
        setError('Demasiados intentos. Por favor, espera un momento.');
        setCanStartCall(false);
        return;
      }

      const data = await response.json();

      if (data.valid) {
        setCallsToday(data.callsToday);
        setCanStartCall(data.canStart);
        
        if (!data.canStart) {
          setError('Has alcanzado el límite de 2 llamadas por día');
        }
      }
    } catch (err: any) {
      console.error('[CallSession] Error verificando límite:', err);
    }
  };

  /**
   * Inicia una nueva llamada
   */
  const startCall = useCallback(async () => {
    if (!loginToken) {
      setError('Token no disponible');
      return;
    }

    try {
      setError(null);

      if (!canStartCall) {
        setError('Has alcanzado el límite de 2 llamadas por día');
        return;
      }

      console.log('[CallSession] Iniciando llamada...');
      setCallState('connecting');

      // 1. Crear llamada en el backend
      const startResponse = await fetch('/api/calls/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginToken }),
      });

      // Manejar rate limiting
      if (startResponse.status === 429) {
        const data = await startResponse.json();
        setError(`Por favor, espera ${data.retryAfter || 60} segundos`);
        setCallState('error');
        return;
      }

      const startData = await startResponse.json();

      if (!startData.success) {
        setError(startData.error || 'No se pudo iniciar la llamada');
        setCallState('error');
        return;
      }

      const callId = startData.callId;
      setCurrentCallId(callId);
      console.log('[CallSession] Call ID creado:', callId);

      // 2. Conectar con ElevenLabs
      const elevenLabsConvId = await connect({ 
        callId,
        userId,
      });

      if (!elevenLabsConvId) {
        // Marcar llamada como fallida
        await fetch('/api/calls/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId }),
        });
        
        setCallState('error');
        return;
      }

      // 3. Guardar conversation_id
      await updateCallWithConversationId(callId, elevenLabsConvId);

      // 4. Iniciar contador
      startTimeRef.current = new Date();
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
          setCallDuration(elapsed);
        }
      }, 1000);

      // 5. Actualizar contadores
      setCallsToday(startData.callsToday);
      if (startData.callsToday >= 2) {
        setCanStartCall(false);
      }

      setCallState('calling');

    } catch (err: any) {
      console.error('[CallSession] Error:', err);
      setError(err.message || 'Error al iniciar la llamada');
      setCallState('error');
    }
  }, [userId, loginToken, canStartCall, connect]);

  /**
   * Finaliza la llamada actual
   */
  const endCall = useCallback(async () => {
    console.log('[CallSession] Finalizando llamada');

    try {
      // 1. Detener contador
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // 2. Desconectar ElevenLabs
      await disconnect();

      // 3. Calcular duración
      const finalDuration = startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000)
        : callDuration;

      // 4. Finalizar en backend
      if (currentCallId) {
        await fetch('/api/calls/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            callId: currentCallId,
            elevenlabsConversationId: conversationId,
          }),
        });
      }

      setCallState('ended');
      setCallDuration(finalDuration);

    } catch (err: any) {
      console.error('[CallSession] Error al finalizar:', err);
      setError('Error al finalizar la llamada');
    }
  }, [disconnect, currentCallId, callDuration, conversationId]);

  /**
   * Reinicia para nueva llamada
   */
  const resetCall = useCallback(() => {
    console.log('[CallSession] Reiniciando');

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setCallState('ready');
    setCallDuration(0);
    setCurrentCallId(null);
    setError(null);
    startTimeRef.current = null;

    // Verificar límite
    if (loginToken) {
      checkDailyLimit();
    }
  }, [loginToken]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    callState,
    callDuration,
    error,
    canStartCall,
    callsToday,
    isSpeaking,
    startCall,
    endCall,
    resetCall,
  };
}