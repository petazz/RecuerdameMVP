'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * SIMULADOR COMPLETO DE ELEVENLABS
 * 
 * Simula una conversación de IA con:
 * - Reconocimiento de voz (Web Speech API)
 * - Síntesis de voz (Text-to-Speech)
 * - Respuestas inteligentes simuladas
 * - Mismo flujo que ElevenLabs real
 */

interface MockAgent {
  name: string;
  responses: string[];
  currentIndex: number;
}

export function useElevenLabs() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>('');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  const mockAgentRef = useRef<MockAgent>({
    name: 'Asistente Virtual',
    currentIndex: 0,
    responses: [
      '¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?',
      'Entiendo. Déjame pensar en eso por un momento.',
      'Esa es una pregunta muy interesante. Te lo explico.',
      'Claro, puedo ayudarte con eso. ¿Quieres que te dé más detalles?',
      '¿Hay algo más en lo que pueda asistirte?',
      'Perfecto. ¿Tienes alguna otra duda?',
      'Gracias por tu pregunta. Aquí está mi respuesta.',
      'Me alegra poder ayudarte. ¿Necesitas algo más?',
    ]
  });

  /**
   * Inicializa Web Speech API (nativa del navegador)
   */
  const initSpeechRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Tu navegador no soporta reconocimiento de voz. Usa Chrome, Edge o Safari.');
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('🎤 Escuchando...');
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      
      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript;
        console.log('💬 Usuario dijo:', transcript);
        setLastTranscript(transcript);
        
        // Simular respuesta del agente después de 1-2 segundos
        setTimeout(() => {
          respondToUser(transcript);
        }, 1000 + Math.random() * 1000);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('❌ Error de reconocimiento:', event.error);
      
      if (event.error === 'no-speech') {
        console.log('ℹ️ No se detectó voz, continuando...');
        return;
      }
      
      setError(`Error de reconocimiento de voz: ${event.error}`);
    };

    recognition.onend = () => {
      console.log('🔴 Reconocimiento detenido');
      setIsListening(false);
      
      // Reiniciar si aún estamos conectados
      if (isConnected) {
        try {
          recognition.start();
        } catch (err) {
          console.log('Ya está iniciado');
        }
      }
    };

    recognitionRef.current = recognition;
  }, [isConnected]);

  /**
   * Genera respuesta inteligente del agente simulado
   */
  const respondToUser = (userInput: string) => {
    const agent = mockAgentRef.current;
    
    // Análisis simple del input para respuestas más contextuales
    let response: string;
    
    const inputLower = userInput.toLowerCase();
    
    if (inputLower.includes('hola') || inputLower.includes('buenos días') || inputLower.includes('buenas tardes')) {
      response = '¡Hola! ¿Cómo estás hoy? Estoy aquí para ayudarte con lo que necesites.';
    } else if (inputLower.includes('adiós') || inputLower.includes('chao') || inputLower.includes('hasta luego')) {
      response = 'Ha sido un placer ayudarte. ¡Que tengas un excelente día! Hasta pronto.';
    } else if (inputLower.includes('gracias')) {
      response = 'De nada, es un placer ayudarte. ¿Hay algo más en lo que pueda asistirte?';
    } else if (inputLower.includes('nombre') || inputLower.includes('quién eres')) {
      response = `Soy ${agent.name}, tu asistente virtual de IA. Estoy aquí para conversar contigo y ayudarte.`;
    } else if (inputLower.includes('cómo estás') || inputLower.includes('que tal')) {
      response = '¡Estoy muy bien, gracias por preguntar! Funcionando perfectamente. ¿Y tú cómo estás?';
    } else if (inputLower.includes('ayuda') || inputLower.includes('puedes hacer')) {
      response = 'Puedo mantener una conversación natural contigo, responder tus preguntas y ayudarte con lo que necesites. ¡Solo háblame con naturalidad!';
    } else {
      // Respuesta genérica rotativa
      response = agent.responses[agent.currentIndex];
      agent.currentIndex = (agent.currentIndex + 1) % agent.responses.length;
    }
    
    console.log('🤖 Agente responde:', response);
    speakText(response);
  };

  /**
   * Convierte texto a voz usando Web Speech API
   */
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) {
      console.error('❌ Tu navegador no soporta síntesis de voz');
      return;
    }

    // Cancelar cualquier voz en progreso
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configurar voz en español
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(voice => 
      voice.lang.startsWith('es-') && voice.name.includes('Female')
    ) || voices.find(voice => voice.lang.startsWith('es-'));
    
    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }
    
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      console.log('🔊 Reproduciendo respuesta...');
    };

    utterance.onend = () => {
      console.log('✅ Respuesta completada');
    };

    utterance.onerror = (event) => {
      console.error('❌ Error al reproducir:', event.error);
    };

    synthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  /**
   * Conecta al "agente" simulado
   */
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    console.log('🔄 Iniciando conexión simulada...');

    try {
      // Validar que el navegador soporte las APIs necesarias
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        throw new Error('Tu navegador no soporta reconocimiento de voz. Usa Chrome, Edge o Safari.');
      }

      if (!('speechSynthesis' in window)) {
        throw new Error('Tu navegador no soporta síntesis de voz.');
      }

      // Solicitar permisos de micrófono
      console.log('🎤 Solicitando permisos de micrófono...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Permisos concedidos');

      // Cargar voces disponibles
      if (window.speechSynthesis.getVoices().length === 0) {
        await new Promise<void>((resolve) => {
          window.speechSynthesis.onvoiceschanged = () => resolve();
        });
      }

      // Simular delay de conexión (como si fuera real)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Inicializar reconocimiento de voz
      initSpeechRecognition();

      // Iniciar reconocimiento
      recognitionRef.current?.start();

      setIsConnected(true);
      setIsConnecting(false);

      console.log('✅ Conexión simulada establecida');

      // Saludo inicial del agente
      setTimeout(() => {
        speakText('¡Hola! Soy tu asistente virtual. Puedes empezar a hablarme cuando quieras. Estoy aquí para ayudarte.');
      }, 500);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al conectar';
      console.error('❌ Error:', msg);
      setError(msg);
      setIsConnecting(false);
    }
  }, [initSpeechRecognition]);

  /**
   * Desconecta el agente simulado
   */
  const disconnect = useCallback(() => {
    console.log('🔌 Desconectando...');

    // Detener reconocimiento de voz
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Detener síntesis de voz
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsConnected(false);
    setIsListening(false);
    setLastTranscript('');
    
    console.log('✅ Desconectado');
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    isListening,
    lastTranscript,
    connect,
    disconnect,
  };
}