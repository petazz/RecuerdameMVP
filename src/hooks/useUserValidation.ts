import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';

interface UserData {
  id: string;
  full_name: string;
  center_id: string;
}

interface ValidationState {
  loading: boolean;
  valid: boolean;
  userData: UserData | null;
  error: string | null;
}

/**
 * Hook personalizado para validar token de usuario y obtener sus datos
 * 
 * @param token - Token único del usuario desde la URL
 * @returns Estado de validación con datos del usuario o error
 * 
 * @example
 * const { loading, valid, userData, error } = useUserValidation(token);
 */
export function useUserValidation(token: string | null): ValidationState {
  const [state, setState] = useState<ValidationState>({
    loading: true,
    valid: false,
    userData: null,
    error: null,
  });

  useEffect(() => {
    // No validar si no hay token
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /**
   * Valida el token contra la base de datos de Supabase
   * 
   * Lógica robusta:
   * 1. Solo marca error si hay un error REAL con mensaje/details
   * 2. Si data existe, el token es válido independientemente del objeto error
   * 3. Si data es null/undefined, el usuario no existe con ese token
   */
  const validateToken = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Consultar usuario por login_token
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, center_id')
        .eq('login_token', token)
        .single();

      // CASO 1: Tenemos datos del usuario → Token válido
      if (data) {
        setState({
          loading: false,
          valid: true,
          userData: data,
          error: null,
        });
        return;
      }

      // CASO 2: Error real con mensaje/details → Error de conexión o permisos
      if (error && (error.message || error.details || error.hint)) {
        // Solo loguear si es un error real, no el error PGRST116 (no rows)
        if (error.code !== 'PGRST116') {
          console.error('Error validando token:', error);
        }
        
        setState({
          loading: false,
          valid: false,
          userData: null,
          error: error.code === 'PGRST116' 
            ? 'No existe ningún usuario con ese token'
            : error.message || 'Error al validar el enlace',
        });
        return;
      }

      // CASO 3: No hay data ni error real → Usuario no existe
      setState({
        loading: false,
        valid: false,
        userData: null,
        error: 'No existe ningún usuario con ese token',
      });

    } catch (err: any) {
      console.error('Error inesperado:', err);
      setState({
        loading: false,
        valid: false,
        userData: null,
        error: err.message || 'Error al validar el enlace',
      });
    }
  };

  return state;
}