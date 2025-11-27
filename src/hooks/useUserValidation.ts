import { useState, useEffect } from 'react';

interface UserData {
  id: string;
  full_name: string;
  canStart: boolean;
  callsToday: number;
}

interface ValidationState {
  loading: boolean;
  valid: boolean;
  userData: UserData | null;
  error: string | null;
}

/**
 * Hook para validar token de usuario usando el endpoint con rate limiting
 * 
 * @param token - Token único del usuario desde la URL
 * @returns Estado de validación con datos del usuario o error
 */
export function useUserValidation(token: string | null): ValidationState {
  const [state, setState] = useState<ValidationState>({
    loading: true,
    valid: false,
    userData: null,
    error: null,
  });

  useEffect(() => {
    if (!token) {
      setState({
        loading: false,
        valid: false,
        userData: null,
        error: 'Token no proporcionado',
      });
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Usar el nuevo endpoint con rate limiting
      const response = await fetch(`/api/public/users/validate?token=${encodeURIComponent(token!)}`);
      
      // Manejar rate limiting
      if (response.status === 429) {
        const data = await response.json();
        setState({
          loading: false,
          valid: false,
          userData: null,
          error: `Por favor, espera ${data.retryAfter || 60} segundos antes de intentar de nuevo`,
        });
        return;
      }

      const data = await response.json();

      if (data.valid) {
        setState({
          loading: false,
          valid: true,
          userData: {
            id: data.userId,
            full_name: data.userName,
            canStart: data.canStart,
            callsToday: data.callsToday,
          },
          error: null,
        });
      } else {
        setState({
          loading: false,
          valid: false,
          userData: null,
          error: 'Enlace no válido o expirado',
        });
      }

    } catch (err: any) {
      console.error('Error validando token:', err);
      setState({
        loading: false,
        valid: false,
        userData: null,
        error: 'Error al validar el enlace',
      });
    }
  };

  return state;
}