'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

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
 * Usa importación dinámica para evitar problemas de SSR
 */
export function useElevenLabs(config?: UseElevenLabsConfig): UseElevenLabsReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const conversationRef = useRef<any>(null);

  // Solicita permisos de micrófono
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

  // Obtiene signed URL del backend
  const getSignedUrl = async (
    callId: string,
    userId?: string,
    userName?: string
  ): Promise<string | null> => {
    try {
      console.log('[ElevenLabs] Solicitando signed URL para callId:', callId);
      console.log('[ElevenLabs] Endpoint:', '/api/elevenlabs/session');
      
      const response = await fetch('/api/elevenlabs/session', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[ElevenLabs] Response status:', response.status);
      console.log('[ElevenLabs] Response ok:', response.ok);
      console.log('[ElevenLabs] Response statusText:', response.statusText);
      
      if (!response.ok) {
        // Intentar obtener el error detallado
        const contentType = response.headers.get('content-type');
        let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        
        console.log('[ElevenLabs] Content-Type:', contentType);
        
        if (contentType?.includes('application/json')) {
          try {
            const errorData = await response.json();
            console.error('[ElevenLabs] Error JSON del servidor:', errorData);
            console.error('[ElevenLabs] Error completo:', JSON.stringify(errorData, null, 2));
            
            // Parsear el detail si es un string JSON anidado
            let parsedDetail = errorData.detail;
            if (typeof errorData.detail === 'string') {
              try {
                parsedDetail = JSON.parse(errorData.detail);
                console.error('[ElevenLabs] Detail parseado:', parsedDetail);
              } catch (e) {
                // No es JSON, usar como string
              }
            }
            
            // Extraer mensaje específico si existe
            if (parsedDetail?.detail?.message) {
              errorDetail = `ElevenLabs: ${parsedDetail.detail.message}`;
            } else {
              errorDetail = errorData.error || errorData.detail || errorData.message || errorDetail;
            }
            
            // Mensaje específico para error 401
            if (response.status === 401) {
              errorDetail = '❌ API Key de ElevenLabs inválida. Por favor verifica tu ELEVENLABS_API_KEY en .env.local';
            }
          } catch (e) {
            console.error('[ElevenLabs] No se pudo parsear error JSON');
          }
        } else {
          const errorText = await response.text();
          console.error('[ElevenLabs] Error texto del servidor:', errorText);
          if (errorText) errorDetail = errorText;
        }
        
        throw new Error(errorDetail);
      }
      
      const data = await response.json();
      console.log('[ElevenLabs] Respuesta completa del backend:', data);
      
      // Validar múltiples formatos de respuesta
      const signedUrl = data.signed_url || data.signedUrl || data.url;
      
      if (!signedUrl) {
        console.error('[ElevenLabs] Respuesta sin signed_url. Data recibida:', data);
        throw new Error('La respuesta del servidor no contiene signed_url');
      }
      
      // Validar formato de URL
      if (!signedUrl.startsWith('wss://')) {
        console.error('[ElevenLabs] signed_url tiene formato inválido:', signedUrl);
        throw new Error('signed_url no tiene el formato esperado (debe empezar con wss://)');
      }
      
      console.log('[ElevenLabs] Signed URL obtenida correctamente');
      return signedUrl;
    } catch (err: any) {
      console.error('[ElevenLabs] Error obteniendo signed URL:', err);
      throw err;
    }
  };

  // Conecta con el agente de ElevenLabs
  const connect = useCallback(
    async (options: ConnectOptions): Promise<string | null> => {
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

        console.log('[ElevenLabs] Iniciando sesión con ElevenLabs...');

        // 3. Importar dinámicamente el SDK (evita problemas de SSR)
        const ElevenLabs = await import('@elevenlabs/client');

        // 4. Iniciar sesión con ElevenLabs usando signed URL
        const conversation = await ElevenLabs.Conversation.startSession({
          signedUrl: signedUrl,
          onModeChange: (mode: { mode: string }) => {
            console.log('[ElevenLabs] Modo:', mode.mode);
            setIsSpeaking(mode.mode === 'speaking');
            config?.onStatusChange?.(mode.mode);
          },
          onMessage: (message: { source: string; message: string }) => {
            console.log('[ElevenLabs] Mensaje:', message.source, '-', message.message);
            config?.onMessage?.({
              role: message.source,
              content: message.message,
            });
          },
          onError: (err: any) => {
            console.error('[ElevenLabs] Error en conversación:', err);
            const errorMsg = typeof err === 'string' ? err : 'Error en la conversación';
            setError(errorMsg);
            config?.onError?.(errorMsg);
          },
          onDisconnect: () => {
            console.log('[ElevenLabs] Desconectado');
            setIsConnected(false);
            setIsSpeaking(false);
            config?.onDisconnect?.();
          },
        });

        conversationRef.current = conversation;

        // Obtener el conversation_id
        const elevenLabsConversationId = conversation.getId ? conversation.getId() : callId;
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
    },
    [config]
  );

  // Desconecta la sesión actual
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