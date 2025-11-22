'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Conversation } from '@11labs/client';

interface UseElevenLabsConfig {
  agentId?: string;
  onMessage?: (message: { role: string; content: string }) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: string) => void;
  onConnect?: (conversationId: string) => void;
  onDisconnect?: () => void;
}

interface ConnectOptions {
  callId: string;
  userId?: string;
  userName?: string;
}

interface UseElevenLabsReturn {
  isConnected: boolean;
  isConnecting: boolean;
  isSpeaking: boolean;
  conversationId: string | null;
  error: string | null;
  connect: (options: ConnectOptions) => Promise<string | null>;
  disconnect: () => Promise<void>;
}

/**
 * Hook para integración con ElevenLabs Conversational AI
 * 
 * IMPORTANTE: Para correlacionar llamadas con el webhook, este hook:
 * 1. Obtiene una signed URL del backend (que incluye el agentId)
 * 2. Inicia la conversación con el SDK
 * 3. Guarda el conversation_id de ElevenLabs en nuestra BD
 * 4. El webhook usa conversation_id para encontrar la llamada
 */
export function useElevenLabs(config?: UseElevenLabsConfig): UseElevenLabsReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const conversationRef = useRef<Conversation | null>(null);

  /**
   * Solicita permisos de micrófono
   */
  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      console.log('[ElevenLabs] Solicitando permisos de micrófono...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('[ElevenLabs] Permisos de micrófono concedidos');
      return true;
    } catch (err: any) {
      console.error('[ElevenLabs] Error solicitando micrófono:', err);
      return false;
    }
  };

  /**
   * Obtiene signed URL del backend
   */
  const getSignedUrl = async (callId: string, userId?: string, userName?: string): Promise<string | null> => {
    try {
      console.log('[ElevenLabs] Obteniendo signed URL para callId:', callId);
      
      const response = await fetch('/api/elevenlabs/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId, userId, userName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error obteniendo signed URL');
      }

      const data = await response.json();
      console.log('[ElevenLabs] Signed URL obtenida');
      return data.signedUrl;
    } catch (err: any) {
      console.error('[ElevenLabs] Error obteniendo signed URL:', err);
      throw err;
    }
  };

  /**
   * Conecta con el agente de ElevenLabs
   * @returns conversation_id de ElevenLabs o null si falla
   */
  const connect = useCallback(async (options: ConnectOptions): Promise<string | null> => {
    const { callId, userId, userName } = options;

    setIsConnecting(true);
    setError(null);

    try {
      // 1. Solicitar permisos de micrófono
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        throw new Error('No se pudo acceder al micrófono. Por favor, permite el acceso.');
      }

      // 2. Obtener signed URL del backend
      const signedUrl = await getSignedUrl(callId, userId, userName);
      if (!signedUrl) {
        throw new Error('No se pudo obtener la URL de conexión');
      }

      console.log('[ElevenLabs] Iniciando sesión con signed URL...');

      // 3. Iniciar sesión con ElevenLabs usando signed URL
      const conversation = await Conversation.startSession({
        signedUrl: signedUrl,

        // Callback cuando el agente empieza/termina de hablar
        onModeChange: (mode) => {
          console.log('[ElevenLabs] Modo:', mode.mode);
          setIsSpeaking(mode.mode === 'speaking');
          config?.onStatusChange?.(mode.mode);
        },

        // Callback para mensajes
        onMessage: (message) => {
          console.log('[ElevenLabs] Mensaje:', message.source, '-', message.message);
          config?.onMessage?.({
            role: message.source,
            content: message.message,
          });
        },

        // Callback para errores
        onError: (err) => {
          console.error('[ElevenLabs] Error en conversación:', err);
          const errorMsg = typeof err === 'string' ? err : 'Error en la conversación';
          setError(errorMsg);
          config?.onError?.(errorMsg);
        },

        // Callback cuando se desconecta
        onDisconnect: () => {
          console.log('[ElevenLabs] Desconectado');
          setIsConnected(false);
          setIsSpeaking(false);
          config?.onDisconnect?.();
        },
      });

      conversationRef.current = conversation;
      
      // 4. Obtener el conversation_id de ElevenLabs
      // El SDK devuelve el ID de la conversación
      const elevenLabsConversationId = conversation.getId();
      console.log('[ElevenLabs] Conversation ID:', elevenLabsConversationId);
      
      setConversationId(elevenLabsConversationId);
      setIsConnected(true);
      
      config?.onConnect?.(elevenLabsConversationId);

      return elevenLabsConversationId;

    } catch (err: any) {
      console.error('[ElevenLabs] Error al conectar:', err);
      const errorMsg = err.message || 'Error al conectar con ElevenLabs';
      setError(errorMsg);
      config?.onError?.(errorMsg);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [config]);

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
      setConversationId(null);
    }
  }, []);

  // Cleanup al desmontar
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
    conversationId,
    error,
    connect,
    disconnect,
  };
}