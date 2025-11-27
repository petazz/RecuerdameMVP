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
 * Interfaz de llamada optimizada para personas mayores
 * - Todo visible sin scroll
 * - Botones grandes y accesibles
 * - Optimizado para móvil
 */
export function CallInterface({ 
  userName, 
  userId, 
  loginToken,
  initialCallsToday = 0,
  initialCanStart = true,
}: CallInterfaceProps) {
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

  const displayCallsToday = callsToday || initialCallsToday;
  const displayCanStart = canStartCall && initialCanStart;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-b from-blue-50 to-white flex flex-col overflow-hidden">
      {/* Header compacto */}
      <header className="flex-shrink-0 bg-white shadow-sm px-4 py-3 safe-area-top">
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">Hola</p>
            <h1 className="text-xl font-bold text-gray-900 truncate max-w-[200px]">
              {userName}
            </h1>
          </div>
        </div>
      </header>

      {/* Contenido principal - ocupa todo el espacio disponible */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 min-h-0">
        
        {/* Estado: Listo para llamar */}
        {callState === 'ready' && (
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            {/* Indicador de estado */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-green-700">Listo</p>
            </div>

            {/* Contador de llamadas */}
            <div className={`w-full px-6 py-4 rounded-2xl border-2 ${
              displayCallsToday >= 2 
                ? 'bg-red-50 border-red-300' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium text-gray-700">Llamadas hoy:</span>
                <span className={`text-3xl font-bold ${
                  displayCallsToday >= 2 ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {displayCallsToday}/2
                </span>
              </div>
              {displayCallsToday >= 2 && (
                <p className="text-sm text-red-600 mt-2 text-center">
                  Límite alcanzado. Vuelve mañana.
                </p>
              )}
            </div>

            {/* Botón Llamar */}
            <button
              onClick={startCall}
              disabled={!displayCanStart}
              className="w-full py-6 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-3xl shadow-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-green-300"
            >
              <div className="flex flex-col items-center gap-2">
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="text-2xl font-bold">LLAMAR</span>
              </div>
            </button>
          </div>
        )}

        {/* Estado: Conectando */}
        {callState === 'connecting' && (
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            <svg className="animate-spin h-20 w-20 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-2xl font-bold text-blue-700">Conectando...</p>
            <p className="text-lg text-gray-600">Un momento</p>
          </div>
        )}

        {/* Estado: Llamada en curso */}
        {callState === 'calling' && (
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            {/* Animación de ondas */}
            <div className="flex items-end justify-center gap-1 h-20">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-3 bg-blue-500 rounded-full animate-pulse"
                  style={{
                    height: `${40 + Math.sin(i) * 20}%`,
                    animationDelay: `${i * 150}ms`,
                    animationDuration: '1s',
                  }}
                />
              ))}
            </div>

            {/* Estado y temporizador */}
            <div className="text-center">
              <p className="text-xl font-bold text-blue-700">En llamada</p>
              <p className="text-5xl font-mono font-bold text-gray-800 mt-2">
                {formatDuration(callDuration)}
              </p>
            </div>

            {/* Botón Colgar */}
            <button
              onClick={endCall}
              className="w-full py-6 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-3xl shadow-lg transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-red-300"
            >
              <div className="flex flex-col items-center gap-2">
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
                <span className="text-2xl font-bold">COLGAR</span>
              </div>
            </button>
          </div>
        )}

        {/* Estado: Llamada finalizada */}
        {callState === 'ended' && (
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-3">
                <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-gray-800">Llamada terminada</p>
              <p className="text-lg text-gray-600 mt-1">¡Gracias!</p>
            </div>

            <button
              onClick={resetCall}
              className="w-full py-6 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-3xl shadow-lg transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              <div className="flex flex-col items-center gap-2">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-xl font-bold">NUEVA LLAMADA</span>
              </div>
            </button>
          </div>
        )}

        {/* Estado: Error */}
        {callState === 'error' && (
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-3">
                <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-red-700">Error</p>
              <p className="text-base text-gray-600 mt-2 px-4">
                {error || 'Ha ocurrido un problema'}
              </p>
            </div>

            <button
              onClick={resetCall}
              className="w-full py-6 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-3xl shadow-lg transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              <div className="flex flex-col items-center gap-2">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-xl font-bold">REINTENTAR</span>
              </div>
            </button>
          </div>
        )}
      </main>

      {/* Footer con instrucciones - siempre visible */}
      <footer className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-bottom">
        <p className="text-center text-base text-gray-600">
          {callState === 'ready' && '👆 Pulsa el botón verde para llamar'}
          {callState === 'connecting' && '⏳ Espera un momento...'}
          {callState === 'calling' && '🔴 Pulsa el botón rojo para colgar'}
          {callState === 'ended' && '🔄 Pulsa para llamar de nuevo'}
          {callState === 'error' && '🔄 Pulsa para reintentar'}
        </p>
      </footer>
    </div>
  );
}