// src/hooks/useCallSession.ts
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useElevenLabs } from '@/hooks/useElevenLabs';

type CallState = 'ready' | 'calling' | 'ended';

interface CallSessionState {
  callState: CallState;
  callDuration: number;
  error: string | null;
  canStartCall: boolean; // Nueva propiedad para límite diario
  callsToday: number;
}

interface CallSessionActions {
  startCall: () => Promise<void>;
  endCall: () => void;
  resetCall: () => void;
}

type UseCallSessionReturn = CallSessionState & CallSessionActions;

// Configuración de ElevenLabs desde variables de entorno
const ELEVENLABS_CONFIG = {
  agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '',
  apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '',
};

/**
 * Hook para manejar sesiones de llamada con ElevenLabs
 * Incluye lógica de límite de 2 llamadas por día
 */
export function useCallSession(userId: string): UseCallSessionReturn {
  const [callState, setCallState] = useState<CallState>('ready');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [canStartCall, setCanStartCall] = useState(true);
  const [callsToday, setCallsToday] = useState(0);

  // Hook de ElevenLabs
  const { isConnected, isConnecting, connect, disconnect, error: elevenLabsError } = 
    useElevenLabs(ELEVENLABS_CONFIG);

  // Verificar límite diario al montar
  useEffect(() => {
    checkDailyLimit();
  }, [userId]);

  // Sincronizar errores de ElevenLabs
  useEffect(() => {
    if (elevenLabsError) {
      setError(elevenLabsError);
    }
  }, [elevenLabsError]);

  /**
   * Verifica el límite de 2 llamadas por día
   */
  const checkDailyLimit = async () => {
    try {
      // 1. Obtener timezone del centro del usuario
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('center_id, centers(timezone)')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      const timezone = (userData.centers as any)?.timezone || 'Europe/Madrid';

      // 2. Calcular inicio del día en el timezone del centro
      const now = new Date();
      const startOfDay = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      startOfDay.setHours(0, 0, 0, 0);

      // 3. Contar llamadas del día
      const { data: calls, error: callsError } = await supabase
        .from('calls')
        .select('id')
        .eq('user_id', userId)
        .in('status', ['started', 'completed'])
        .gte('started_at', startOfDay.toISOString());

      if (callsError) throw callsError;

      const todayCount = calls?.length || 0;
      setCallsToday(todayCount);
      setCanStartCall(todayCount < 2);

      if (todayCount >= 2) {
        setError('Has alcanzado el límite de 2 llamadas por día');
      }

    } catch (err: any) {
      console.error('[CallSession] Error verificando límite:', err);
      setError('Error al verificar límite de llamadas');
    }
  };

  /**
   * Inicia una nueva llamada
   */
  const startCall = useCallback(async () => {
    try {
      setError(null);

      // Verificar límite antes de iniciar
      if (!canStartCall) {
        setError('Has alcanzado el límite de 2 llamadas por día');
        return;
      }

      console.log('[CallSession] Iniciando llamada para usuario:', userId);

      // 1. Crear registro de llamada en BD
      const { data: callData, error: callError } = await supabase
        .from('calls')
        .insert([
          {
            user_id: userId,
            center_id: (await getUserCenterId(userId)),
            started_at: new Date().toISOString(),
            status: 'started',
          },
        ])
        .select()
        .single();

      if (callError) throw callError;

      setCurrentCallId(callData.id);
      console.log('[CallSession] Call ID creado:', callData.id);

      // 2. Conectar con ElevenLabs
      await connect();

      // 3. Actualizar estado de UI
      setCallState('calling');

      // 4. Iniciar contador de duración
      const id = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      setIntervalId(id);

      // 5. Actualizar contadores
      setCallsToday(prev => prev + 1);
      if (callsToday + 1 >= 2) {
        setCanStartCall(false);
      }

    } catch (err: any) {
      console.error('[CallSession] Error al iniciar llamada:', err);
      setError(err.message || 'Error al iniciar la llamada');
      setCallState('ready');

      // Limpiar llamada fallida
      if (currentCallId) {
        await supabase
          .from('calls')
          .update({ status: 'failed', ended_at: new Date().toISOString() })
          .eq('id', currentCallId);
      }
    }
  }, [userId, canStartCall, connect, callsToday, currentCallId]);

  /**
   * Finaliza la llamada actual
   */
  const endCall = useCallback(async () => {
    console.log('[CallSession] Finalizando llamada');

    try {
      // 1. Detener contador
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }

      // 2. Desconectar ElevenLabs
      disconnect();

      // 3. Actualizar registro en BD
      if (currentCallId) {
        await supabase
          .from('calls')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
            duration_seconds: callDuration,
          })
          .eq('id', currentCallId);
      }

      setCallState('ended');

    } catch (err: any) {
      console.error('[CallSession] Error al finalizar llamada:', err);
      setError('Error al finalizar la llamada');
    }
  }, [intervalId, disconnect, currentCallId, callDuration]);

  /**
   * Reinicia la interfaz para nueva llamada
   */
  const resetCall = useCallback(() => {
    console.log('[CallSession] Reiniciando interfaz');

    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }

    setCallState('ready');
    setCallDuration(0);
    setCurrentCallId(null);
    setError(null);

    // Verificar límite de nuevo
    checkDailyLimit();
  }, [intervalId]);

  return {
    callState,
    callDuration,
    error,
    canStartCall,
    callsToday,
    startCall,
    endCall,
    resetCall,
  };
}

/**
 * Obtiene el center_id del usuario
 */
async function getUserCenterId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('center_id')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data.center_id;
}