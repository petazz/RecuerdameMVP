'use client';

import { useParams } from 'next/navigation';
import { useUserValidation } from '@/hooks/useUserValidation';
import { CallInterface } from '@/components/CallInterface';
import { UserNotFound } from '@/components/UserNotFound';

/**
 * Página principal para usuarios finales
 * Acceso mediante token único en la URL: /u/[token]
 */
export default function UserSessionPage() {
  const params = useParams();
  const token = params?.token as string;

  // Hook para validación de token (usa endpoint con rate limiting)
  const { loading, valid, userData, error } = useUserValidation(token);

  // Estado de carga
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-8">
          <svg
            className="animate-spin h-24 w-24 mx-auto text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            role="status"
            aria-label="Cargando"
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
          <p className="text-4xl font-bold text-gray-900">
            Cargando...
          </p>
          <p className="text-2xl text-gray-600">
            Por favor, espera un momento
          </p>
        </div>
      </div>
    );
  }

  // Token inválido o error
  if (!valid || !userData) {
    return <UserNotFound message={error || 'Enlace no válido o expirado'} />;
  }

  // Token válido: Mostrar interfaz de llamada
  // ✅ AHORA PASAMOS loginToken
  return (
    <CallInterface
      userName={userData.full_name}
      userId={userData.id}
      loginToken={token}
      initialCallsToday={userData.callsToday}
      initialCanStart={userData.canStart}
    />
  );
}