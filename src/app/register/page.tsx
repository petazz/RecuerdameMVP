'use client';

import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Icono de advertencia */}
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          {/* Título */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Registro Deshabilitado
          </h1>
          
          {/* Descripción */}
          <p className="text-gray-600">
            El registro público está deshabilitado. Solo los administradores pueden crear nuevas cuentas de managers.
          </p>
        </div>
        
        {/* Información adicional */}
        <div className="space-y-4 mb-6">
          <p className="text-sm text-gray-600">
            Si necesitas acceso al sistema, por favor contacta con un administrador.
          </p>
        </div>
        
        {/* Botón para ir al login */}
        <Link href="/login">
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200">
            Ir al Login
          </button>
        </Link>
      </div>
    </div>
  );
}