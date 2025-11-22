'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Conversation } from '@11labs/client';

interface UseElevenLabsConfig {
  agentId: string;
  onMessage?: (message: { role: string; content: string }) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: string) => void;
}

interface UseElevenLabsReturn {
  isConnected: boolean;
  isConnecting: boolean;
  isSpeaking: boolean;
  error: string | null;
  connect: (metadata?: Record<string, string>) => Promise<void>;
  disconnect: () => Promise<void>;
}

/**
 * Hook para integración real con ElevenLabs Conversational AI
 * Usa el SDK oficial @11labs/client
 */
export function useElevenLabs(config?: UseElevenLabsConfig): UseElevenLabsReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationRef = useRef<Conversation | null>(null);
  const agentId = config?.agentId || process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '';

  /**
   * Solicita permisos de micrófono
   */
  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Detener tracks después de obtener permiso
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.error('[ElevenLabs] Error solicitando micrófono:', err);
      return false;
    }
  };

  /**
   * Conecta con el agente de ElevenLabs
   * @param metadata - Datos adicionales como callId para correlacionar webhook
   */
  const connect = useCallback(async (metadata?: Record<string, string>) => {
    if (!agentId) {
      setError('No se ha configurado el Agent ID de ElevenLabs');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // 1. Solicitar permisos de micrófono
      console.log('[ElevenLabs] Solicitando permisos de micrófono...');
      const hasPermission = await requestMicrophonePermission();
      
      if (!hasPermission) {
        throw new Error('No se pudo acceder al micrófono. Por favor, permite el acceso.');
      }

      console.log('[ElevenLabs] Iniciando conexión con agente:', agentId);

      // 2. Iniciar sesión con ElevenLabs
      const conversation = await Conversation.startSession({
        agentId: agentId,
        
        // Callback cuando el agente empieza/termina de hablar
        onModeChange: (mode) => {
          console.log('[ElevenLabs] Modo cambiado:', mode.mode);
          setIsSpeaking(mode.mode === 'speaking');
          config?.onStatusChange?.(mode.mode);
        },

        // Callback para mensajes de la conversación
        onMessage: (message) => {
          console.log('[ElevenLabs] Mensaje:', message);
          config?.onMessage?.({
            role: message.source,
            content: message.message,
          });
        },

        // Callback para errores
        onError: (err) => {
          console.error('[ElevenLabs] Error:', err);
          const errorMsg = typeof err === 'string' ? err : 'Error en la conversación';
          setError(errorMsg);
          config?.onError?.(errorMsg);
        },

        // Callback cuando se desconecta
        onDisconnect: () => {
          console.log('[ElevenLabs] Desconectado');
          setIsConnected(false);
          setIsSpeaking(false);
        },

        // Metadata personalizada (incluye callId para webhook)
        customLlmExtraBody: metadata ? { metadata } : undefined,
      });

      conversationRef.current = conversation;
      setIsConnected(true);
      console.log('[ElevenLabs] Conexión establecida correctamente');

    } catch (err: any) {
      console.error('[ElevenLabs] Error al conectar:', err);
      const errorMsg = err.message || 'Error al conectar con ElevenLabs';
      setError(errorMsg);
      config?.onError?.(errorMsg);
    } finally {
      setIsConnecting(false);
    }
  }, [agentId, config]);

  /**
   * Desconecta la sesión actual
   */
  const disconnect = useCallback(async () => {
    console.log('[ElevenLabs] Desconectando...');

    try {
      if (conversationRef.current) {
        await conversationRef.current.endSession();
        conversationRef.current = null;
      }
    } catch (err) {
      console.error('[ElevenLabs] Error al desconectar:', err);
    } finally {
      setIsConnected(false);
      setIsSpeaking(false);
    }
  }, []);

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      if (conversationRef.current) {
        conversationRef.current.endSession().catch(console.error);
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    isSpeaking,
    error,
    connect,
    disconnect,
  };
}