'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/Button';
import { useToast } from '@/components/ToastContext';

interface Call {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
  elevenlabs_conversation_id: string | null;
}

interface User {
  id: string;
  full_name: string;
  login_token: string;
  center_id: string;
  created_at: string;
}

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'manager';
  center_id?: string | null;
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // Paginación
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetchUserAndCalls();
  }, [userId, page]);

  const fetchUserAndCalls = async () => {
    try {
      // Verificar perfil del manager
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        router.replace('/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role, center_id')
        .eq('id', userData.user.id)
        .single();

      if (profileError || !profileData) {
        showToast('Error al cargar perfil', 'error');
        router.replace('/login');
        return;
      }

      setProfile(profileData);

      // Obtener usuario
      const { data: userInfo, error: userInfoError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userInfoError) {
        showToast('Usuario no encontrado', 'error');
        router.replace('/dashboard/usuarios');
        return;
      }

      // Verificar que el manager tiene acceso a este usuario
      if (profileData.role !== 'admin' && profileData.center_id !== userInfo.center_id) {
        showToast('No tienes permisos para ver este usuario', 'error');
        router.replace('/dashboard/usuarios');
        return;
      }

      setUser(userInfo);

      // Obtener llamadas del usuario (paginadas)
      const { data: callsData, error: callsError } = await supabase
        .from('calls')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (callsError) throw callsError;
      
      setCalls(callsData || []);
      setHasMore((callsData || []).length === PAGE_SIZE);
    } catch (err: any) {
      console.error('Error:', err);
      showToast(err.message || 'Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      completed: 'bg-green-100 text-green-800 border-green-300',
      started: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      failed: 'bg-red-100 text-red-800 border-red-300',
    };
    const labels = {
      completed: 'Completada',
      started: 'En curso',
      failed: 'Fallida',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold border-2 ${badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Enlace copiado', 'success');
  };

  if (loading) {
    return (
      <DashboardLayout profile={profile ? { 
        email: profile.email, 
        role: profile.role, 
        center_id: profile.center_id || undefined 
      } : undefined}>
        <LoadingSpinner size="lg" />
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout profile={profile ? { 
        email: profile.email, 
        role: profile.role, 
        center_id: profile.center_id || undefined 
      } : undefined}>
        <div className="text-center py-12">
          <p className="text-xl text-red-600">Usuario no encontrado</p>
        </div>
      </DashboardLayout>
    );
  }

  // Calcular estadísticas
  const totalCalls = calls.length;
  const completedCalls = calls.filter(c => c.status === 'completed').length;
  const totalDuration = calls
    .filter(c => c.duration_seconds)
    .reduce((acc, c) => acc + (c.duration_seconds || 0), 0);

  return (
    <DashboardLayout profile={profile ? { 
      email: profile.email, 
      role: profile.role, 
      center_id: profile.center_id || undefined 
    } : undefined}>
      <div className="space-y-8">
        {/* Header con info del usuario */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.back()}
              className="mb-4"
            >
              ← Volver
            </Button>
            <h1 className="text-4xl font-bold text-gray-900">{user.full_name}</h1>
            <p className="text-xl text-gray-600 mt-2">
              Usuario desde {new Date(user.created_at).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
          
          <Button
            variant="secondary"
            size="md"
            onClick={() => copyToClipboard(`${window.location.origin}/u/${user.login_token}`)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copiar Enlace
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total de llamadas</p>
                <p className="text-2xl font-bold text-gray-900">{totalCalls}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Completadas</p>
                <p className="text-2xl font-bold text-gray-900">{completedCalls}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tiempo total</p>
                <p className="text-2xl font-bold text-gray-900">{formatDuration(totalDuration)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de llamadas */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b-2 border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Historial de Llamadas</h2>
          </div>

          {calls.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <p className="text-xl text-gray-600">No hay llamadas registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Fecha y Hora</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Duración</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Estado</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {calls.map((call) => (
                    <tr key={call.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-base text-gray-900 font-medium">
                          {new Date(call.started_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(call.started_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-base text-gray-900 font-mono">
                          {formatDuration(call.duration_seconds)}
                        </p>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(call.status)}</td>
                      <td className="px-6 py-4">
                        {call.status === 'completed' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/dashboard/llamadas/${call.id}`)}
                          >
                            Ver Transcripción
                          </Button>
                        )}
                        {call.status !== 'completed' && (
                          <span className="text-sm text-gray-500">Sin transcripción</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {calls.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t-2 border-gray-200">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Anterior
              </Button>
              <span className="text-lg text-gray-600">Página {page + 1}</span>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setPage(p => p + 1)}
                disabled={!hasMore}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}