'use client';

import { useCallSession } from '@/hooks/useCallSession';

interface CallInterfaceProps {
  userName: string;
  userId: string;
  loginToken: string;
  initialCallsToday?: number;
  initialCanStart?: boolean;
}

/**
 * Componente principal de interfaz de llamada
 * Diseñado para personas mayores con botones grandes y alto contraste
 */
export function CallInterface({ 
  userName, 
  userId, 
  loginToken,
  initialCallsToday = 0,
  initialCanStart = true,
}: CallInterfaceProps) {
  // Hook para gestionar el estado de la llamada (ahora usa endpoints con rate limiting)
  const { 
    callState, 
    callDuration, 
    error, 
    canStartCall, 
    callsToday, 
    startCall, 
    endCall, 
    resetCall 
  } = useCallSession(userId, loginToken);

  // Usar valores iniciales si están disponibles
  const displayCallsToday = callsToday || initialCallsToday;
  const displayCanStart = canStartCall && initialCanStart;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartCall = async () => {
    await startCall();
  };

  const handleEndCall = () => {
    endCall();
  };

  const handleNewCall = () => {
    resetCall();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-8">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-32 h-32 bg-blue-600 rounded-full mb-6">
            <svg 
              className="w-20 h-20 text-white" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
              />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Hola, {userName}
          </h1>
        </div>

        {/* Contenedor principal */}
        <div className="bg-white rounded-3xl shadow-2xl p-12">
          {/* Estado: Listo para llamar */}
          {callState === 'ready' && (
            <div className="text-center space-y-10">
              <div className="space-y-6">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-4">
                  <svg 
                    className="w-16 h-16 text-green-600" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                    />
                  </svg>
                </div>
                <p className="text-4xl font-bold text-green-700">
                  Listo para llamar
                </p>
                <p className="text-2xl text-gray-600 leading-relaxed">
                  Pulsa el botón verde cuando quieras hablar con el asistente
                </p>
              </div>

              {/* Contador de llamadas */}
              <div className="inline-flex items-center gap-6 bg-blue-50 px-10 py-6 rounded-2xl border-4 border-blue-200 shadow-lg">
                <svg 
                  className="w-16 h-16 text-blue-600 flex-shrink-0" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" 
                  />
                </svg>
                <div className="text-left">
                  <p className="text-xl text-gray-700 font-semibold mb-1">
                    Llamadas realizadas hoy
                  </p>
                  <p className="text-5xl font-bold text-blue-700">
                    {displayCallsToday} <span className="text-3xl text-gray-500">de 2</span>
                  </p>
                </div>
              </div>

              {/* Botón Iniciar */}
              <button
                onClick={handleStartCall}
                disabled={!displayCanStart}
                className="w-full py-10 px-12 bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-xl transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-8 focus:ring-green-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ minHeight: '120px' }}
              >
                <div className="flex flex-col items-center gap-4">
                  <svg 
                    className="w-20 h-20" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" 
                    />
                  </svg>
                  <span className="text-4xl font-bold">
                    Iniciar Llamada
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Estado: Conectando */}
          {callState === 'connecting' && (
            <div className="text-center space-y-10">
              <div className="space-y-6">
                <svg
                  className="animate-spin h-24 w-24 mx-auto text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-4xl font-bold text-blue-700">
                  Conectando...
                </p>
                <p className="text-2xl text-gray-600">
                  Por favor, espera un momento
                </p>
              </div>
            </div>
          )}

          {/* Estado: Llamada en curso */}
          {callState === 'calling' && (
            <div className="text-center space-y-10">
              <div className="space-y-6">
                {/* Animación de ondas */}
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="w-4 h-16 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="w-4 h-24 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-4 h-32 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                  <div className="w-4 h-24 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
                  <div className="w-4 h-16 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '600ms' }} />
                </div>
                
                <p className="text-4xl font-bold text-blue-700">
                  Llamada en curso
                </p>
                
                <p className="text-5xl font-mono font-bold text-gray-800">
                  {formatDuration(callDuration)}
                </p>
                
                <p className="text-2xl text-gray-600 leading-relaxed">
                  Estás hablando con el asistente
                </p>
              </div>

              {/* Botón Finalizar */}
              <button
                onClick={handleEndCall}
                className="w-full py-10 px-12 bg-red-500 hover:bg-red-600 text-white rounded-2xl shadow-xl transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-8 focus:ring-red-300 active:scale-95"
                style={{ minHeight: '120px' }}
              >
                <div className="flex flex-col items-center gap-4">
                  <svg 
                    className="w-20 h-20" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" 
                    />
                  </svg>
                  <span className="text-4xl font-bold">
                    Finalizar Llamada
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Estado: Llamada finalizada */}
          {callState === 'ended' && (
            <div className="text-center space-y-10">
              <div className="space-y-6">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 rounded-full mb-4">
                  <svg 
                    className="w-16 h-16 text-gray-600" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M5 13l4 4L19 7" 
                    />
                  </svg>
                </div>
                <p className="text-4xl font-bold text-gray-800">
                  Llamada finalizada
                </p>
                <p className="text-2xl text-gray-600 leading-relaxed">
                  Gracias por usar el servicio
                </p>
              </div>

              {/* Botón Nueva Llamada */}
              <button
                onClick={handleNewCall}
                className="w-full py-10 px-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-8 focus:ring-blue-300 active:scale-95"
                style={{ minHeight: '120px' }}
              >
                <div className="flex flex-col items-center gap-4">
                  <svg 
                    className="w-20 h-20" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                    />
                  </svg>
                  <span className="text-4xl font-bold">
                    Nueva Llamada
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Estado: Error */}
          {callState === 'error' && (
            <div className="text-center space-y-10">
              <div className="space-y-6">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 rounded-full mb-4">
                  <svg 
                    className="w-16 h-16 text-red-600" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                    />
                  </svg>
                </div>
                <p className="text-4xl font-bold text-red-700">
                  Error
                </p>
                <p className="text-2xl text-gray-600">
                  {error || 'Ha ocurrido un problema'}
                </p>
              </div>

              <button
                onClick={handleNewCall}
                className="w-full py-10 px-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-8 focus:ring-blue-300 active:scale-95"
                style={{ minHeight: '120px' }}
              >
                <div className="flex flex-col items-center gap-4">
                  <svg 
                    className="w-20 h-20" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                    />
                  </svg>
                  <span className="text-4xl font-bold">
                    Intentar de nuevo
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Mostrar errores */}
        {error && callState !== 'error' && (
          <div className="mt-6 p-6 bg-red-100 border-4 border-red-500 rounded-2xl">
            <p className="text-2xl font-bold text-red-700 text-center">
              ⚠️ {error}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xl text-gray-600">
            {callState === 'ready' && 'Presiona el botón verde para comenzar'}
            {callState === 'connecting' && 'Conectando con el asistente...'}
            {callState === 'calling' && 'Presiona el botón rojo cuando termines'}
            {callState === 'ended' && 'Presiona el botón azul para llamar de nuevo'}
            {callState === 'error' && 'Presiona el botón azul para intentar de nuevo'}
          </p>
        </div>
      </div>
    </div>
  );
}