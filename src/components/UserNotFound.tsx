'use client';

interface UserNotFoundProps {
  message?: string;
}

/**
 * Componente que muestra un mensaje de error cuando el token no es válido
 * Diseño accesible con texto grande y claro
 */
export function UserNotFound({ message = 'Enlace no válido o expirado' }: UserNotFoundProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-8">
      <div className="w-full max-w-3xl">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center space-y-8">
          {/* Icono de error grande */}
          <div className="inline-flex items-center justify-center w-32 h-32 bg-red-100 rounded-full mb-6">
            <svg 
              className="w-20 h-20 text-red-600" 
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

          {/* Mensaje de error */}
          <div className="space-y-6">
            <h1 className="text-5xl font-bold text-gray-900">
              Acceso no válido
            </h1>
            <p className="text-3xl text-red-600 font-semibold leading-relaxed">
              {message}
            </p>
          </div>

          {/* Información adicional */}
          <div className="bg-gray-50 rounded-2xl p-8 mt-8">
            <p className="text-2xl text-gray-700 leading-relaxed mb-6">
              Si necesitas ayuda, por favor contacta con:
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4 text-2xl text-gray-800">
                <svg 
                  className="w-10 h-10 text-blue-600" 
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
                <span className="font-semibold">Tu centro de atención</span>
              </div>
              <div className="flex items-center justify-center gap-4 text-2xl text-gray-800">
                <svg 
                  className="w-10 h-10 text-blue-600" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" 
                  />
                </svg>
                <span className="font-semibold">El personal del centro</span>
              </div>
            </div>
          </div>

          {/* Mensaje de seguridad */}
          <div className="pt-6 border-t-2 border-gray-200">
            <p className="text-xl text-gray-600 leading-relaxed">
              Este enlace puede haber expirado o ser incorrecto.
              <br />
              Solicita un nuevo enlace de acceso.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}