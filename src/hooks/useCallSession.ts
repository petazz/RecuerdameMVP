'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
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
 * FLUJO DE CORRELACIÓN:
 * 1. Crear registro 'calls' en BD con status='started'
 * 2. Conectar con ElevenLabs y obtener conversation_id
 * 3. Guardar conversation_id en el registro 'calls'
 * 4. Cuando ElevenLabs envía webhook, buscar por conversation_id
 * 5. Guardar transcripción vinculada a la llamada
 */
export function useCallSession(userId: string): UseCallSessionReturn {
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
      // Guardar conversation_id en la BD para correlación con webhook
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
    checkDailyLimit();
  }, [userId]);

  // Sincronizar estado de conexión
  useEffect(() => {
    if (isConnecting) {
      setCallState('connecting');
    } else if (isConnected) {
      setCallState('calling');
    }
  }, [isConnected, isConnecting]);

  // Sincronizar errores de ElevenLabs
  useEffect(() => {
    if (elevenLabsError) {
      setError(elevenLabsError);
    }
  }, [elevenLabsError]);

  /**
   * Actualiza el registro de llamada con el conversation_id de ElevenLabs
   * Esto es CRÍTICO para correlacionar el webhook
   */
  const updateCallWithConversationId = async (callId: string, convId: string) => {
    try {
      console.log('[CallSession] ========================================');
      console.log('[CallSession] 🔑 GUARDANDO CONVERSATION_ID EN BD');
      console.log('[CallSession] - Call ID:', callId);
      console.log('[CallSession] - Conversation ID:', convId);
      console.log('[CallSession] ========================================');
      
      const { data, error: updateError } = await supabase
        .from('calls')
        .update({ 
          elevenlabs_conversation_id: convId,
        })
        .eq('id', callId)
        .select();

      if (updateError) {
        console.error('[CallSession] ❌ Error guardando conversation_id:', updateError);
        console.error('[CallSession] Error completo:', JSON.stringify(updateError, null, 2));
      } else {
        console.log('[CallSession] ✅ conversation_id guardado correctamente');
        console.log('[CallSession] Datos actualizados:', data);
      }
    } catch (err) {
      console.error('[CallSession] ❌ Error en updateCallWithConversationId:', err);
    }
  };

  /**
   * Verifica el límite de 2 llamadas por día según timezone del centro
   */
  const checkDailyLimit = async () => {
    try {
      // 1. Obtener timezone del centro
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('center_id, centers(timezone)')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('[CallSession] Error obteniendo usuario:', userError);
        return;
      }

      const timezone = (userData?.centers as any)?.timezone || 'Europe/Madrid';

      // 2. Calcular inicio del día en timezone del centro
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const todayStr = formatter.format(now);
      const startOfDay = new Date(`${todayStr}T00:00:00`);

      // 3. Contar llamadas del día
      const { data: calls, error: callsError } = await supabase
        .from('calls')
        .select('id')
        .eq('user_id', userId)
        .in('status', ['started', 'completed'])
        .gte('started_at', startOfDay.toISOString());

      if (callsError) {
        console.error('[CallSession] Error contando llamadas:', callsError);
        return;
      }

      const todayCount = calls?.length || 0;
      setCallsToday(todayCount);
      setCanStartCall(todayCount < 2);

      console.log('[CallSession] Llamadas hoy:', todayCount, '- Puede llamar:', todayCount < 2);

      if (todayCount >= 2) {
        setError('Has alcanzado el límite de 2 llamadas por día');
      }
    } catch (err: any) {
      console.error('[CallSession] Error verificando límite:', err);
    }
  };

  /**
   * Obtiene el center_id del usuario
   */
  const getUserCenterId = async (): Promise<string> => {
    const { data, error } = await supabase
      .from('users')
      .select('center_id')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data.center_id;
  };

  /**
   * Inicia una nueva llamada
   */
  const startCall = useCallback(async () => {
    try {
      setError(null);

      // Verificar límite
      if (!canStartCall) {
        setError('Has alcanzado el límite de 2 llamadas por día');
        return;
      }

      console.log('[CallSession] Iniciando llamada para usuario:', userId);
      setCallState('connecting');

      // 1. Crear registro de llamada en BD
      const centerId = await getUserCenterId();
      const { data: callData, error: callError } = await supabase
        .from('calls')
        .insert([{
          user_id: userId,
          center_id: centerId,
          started_at: new Date().toISOString(),
          status: 'started',
        }])
        .select()
        .single();

      if (callError) {
        console.error('[CallSession] Error creando llamada:', callError);
        throw callError;
      }

      const callId = callData.id;
      setCurrentCallId(callId);
      console.log('[CallSession] Call ID creado:', callId);

      // 2. Conectar con ElevenLabs (pasando callId para referencia)
      const elevenLabsConvId = await connect({ 
        callId,
        userId,
      });

      // 3. CRÍTICO: Guardar conversation_id inmediatamente después de conectar
      if (elevenLabsConvId) {
        console.log('[CallSession] 🔑 Guardando conversation_id inmediatamente después de connect...');
        await updateCallWithConversationId(callId, elevenLabsConvId);
      }

      if (!elevenLabsConvId) {
        // La conexión falló, marcar llamada como fallida
        await supabase
          .from('calls')
          .update({ 
            status: 'failed', 
            ended_at: new Date().toISOString() 
          })
          .eq('id', callId);
        
        setCallState('error');
        return;
      }

      // 3. Iniciar contador de duración
      startTimeRef.current = new Date();
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
          setCallDuration(elapsed);
        }
      }, 1000);

      // 4. Actualizar contadores
      setCallsToday(prev => prev + 1);
      if (callsToday + 1 >= 2) {
        setCanStartCall(false);
      }

      setCallState('calling');

    } catch (err: any) {
      console.error('[CallSession] Error al iniciar llamada:', err);
      setError(err.message || 'Error al iniciar la llamada');
      setCallState('error');
    }
  }, [userId, canStartCall, connect, callsToday]);

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

      // 3. Calcular duración final
      const finalDuration = startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000)
        : callDuration;

      // 4. Actualizar registro en BD
      if (currentCallId) {
        const { error: updateError } = await supabase
          .from('calls')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
            duration_seconds: finalDuration,
          })
          .eq('id', currentCallId);

        if (updateError) {
          console.error('[CallSession] Error actualizando llamada:', updateError);
        }
      }

      setCallState('ended');
      setCallDuration(finalDuration);

    } catch (err: any) {
      console.error('[CallSession] Error al finalizar llamada:', err);
      setError('Error al finalizar la llamada');
    }
  }, [disconnect, currentCallId, callDuration]);

  /**
   * Reinicia la interfaz para nueva llamada
   */
  const resetCall = useCallback(() => {
    console.log('[CallSession] Reiniciando interfaz');

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setCallState('ready');
    setCallDuration(0);
    setCurrentCallId(null);
    setError(null);
    startTimeRef.current = null;

    // Verificar límite de nuevo
    checkDailyLimit();
  }, []);

  // Cleanup al desmontar
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