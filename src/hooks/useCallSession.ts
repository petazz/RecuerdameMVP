import { useState, useCallback } from 'react';

type CallState = 'ready' | 'calling' | 'ended';

interface CallSessionState {
  callState: CallState;
  callDuration: number;
  error: string | null;
}

interface CallSessionActions {
  startCall: () => Promise<void>;
  endCall: () => void;
  resetCall: () => void;
}

type UseCallSessionReturn = CallSessionState & CallSessionActions;

/**
 * Hook personalizado para manejar el estado de una sesión de llamada
 * Gestiona inicio, finalización y reinicio de llamadas
 * 
 * @param userId - ID del usuario que realiza la llamada
 * @returns Estado y acciones de la sesión de llamada
 * 
 * @example
 * const { callState, startCall, endCall, resetCall } = useCallSession(userId);
 */
export function useCallSession(userId: string): UseCallSessionReturn {
  const [callState, setCallState] = useState<CallState>('ready');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  /**
   * Inicia una nueva llamada
   * TODO: Integrar con ElevenLabs API
   */
  const startCall = useCallback(async () => {
    try {
      setError(null);
      
      console.log('[CallSession] Iniciando llamada para usuario:', userId);
      
      // TODO: Inicializar conexión con ElevenLabs
      // const elevenLabsSession = await initElevenLabsCall({
      //   userId,
      //   voiceId: 'tu-voice-id',
      //   apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
      // });

      // Simular inicio de llamada exitoso
      setCallState('calling');
      
      // Iniciar contador de duración
      const id = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      setIntervalId(id);

      // Registrar inicio de llamada en base de datos (opcional)
      // await logCallStart(userId);
      
    } catch (err: any) {
      console.error('[CallSession] Error al iniciar llamada:', err);
      setError(err.message || 'Error al iniciar la llamada');
      setCallState('ready');
    }
  }, [userId]);

  /**
   * Finaliza la llamada actual
   */
  const endCall = useCallback(() => {
    console.log('[CallSession] Finalizando llamada');
    
    // Detener contador de duración
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }

    // TODO: Cerrar conexión con ElevenLabs
    // await closeElevenLabsConnection();

    // Registrar fin de llamada (opcional)
    // await logCallEnd(userId, callDuration);

    setCallState('ended');
  }, [intervalId, userId, callDuration]);

  /**
   * Reinicia la interfaz para una nueva llamada
   */
  const resetCall = useCallback(() => {
    console.log('[CallSession] Reiniciando interfaz para nueva llamada');
    
    // Limpiar contador si existe
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }

    setCallState('ready');
    setCallDuration(0);
    setError(null);
  }, [intervalId]);

  return {
    callState,
    callDuration,
    error,
    startCall,
    endCall,
    resetCall,
  };
}