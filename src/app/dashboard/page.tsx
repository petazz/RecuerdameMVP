'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/ToastContext';

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'manager';
  center_id?: string | null;
}

interface DashboardStats {
  totalUsers: number;
  callsToday: number;
  totalManagers: number;
  totalCenters: number;
  totalCalls: number;
  avgCallDuration: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    callsToday: 0,
    totalManagers: 0,
    totalCenters: 0,
    totalCalls: 0,
    avgCallDuration: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
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

      // Cargar estadísticas según el rol
      if (profileData.role === 'admin') {
        await loadAdminStats();
      } else {
        await loadManagerStats(profileData.center_id);
      }

    } catch (err: any) {
      showToast(err.message || 'Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAdminStats = async () => {
    try {
      // Total usuarios
      const { count: usersCount } = await supabase
        .from('users')
        .select('id', { count: 'exact' });

      // Total centros
      const { count: centersCount } = await supabase
        .from('centers')
        .select('id', { count: 'exact' });

      // Total managers
      const { count: managersCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .in('role', ['manager', 'admin']);

      // Llamadas hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: callsTodayCount } = await supabase
        .from('calls')
        .select('id', { count: 'exact' })
        .gte('started_at', today.toISOString())
        .in('status', ['started', 'completed']);

      // Total llamadas completadas
      const { count: totalCallsCount } = await supabase
        .from('calls')
        .select('id', { count: 'exact' })
        .eq('status', 'completed');

      // Duración promedio
      const { data: callsData } = await supabase
        .from('calls')
        .select('duration_seconds')
        .eq('status', 'completed')
        .not('duration_seconds', 'is', null);

      let avgDuration = 0;
      if (callsData && callsData.length > 0) {
        const total = callsData.reduce((acc, call) => acc + (call.duration_seconds || 0), 0);
        avgDuration = Math.floor(total / callsData.length);
      }

      setStats({
        totalUsers: usersCount || 0,
        callsToday: callsTodayCount || 0,
        totalManagers: managersCount || 0,
        totalCenters: centersCount || 0,
        totalCalls: totalCallsCount || 0,
        avgCallDuration: avgDuration,
      });

    } catch (err: any) {
      console.error('Error loading admin stats:', err);
    }
  };

  const loadManagerStats = async (centerId: string | null | undefined) => {
    if (!centerId) return;

    try {
      // Usuarios del centro
      const { count: usersCount } = await supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('center_id', centerId);

      // Llamadas hoy del centro
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: centerUsers } = await supabase
        .from('users')
        .select('id')
        .eq('center_id', centerId);

      const userIds = centerUsers?.map(u => u.id) || [];

      const { count: callsTodayCount } = await supabase
        .from('calls')
        .select('id', { count: 'exact' })
        .in('user_id', userIds)
        .gte('started_at', today.toISOString())
        .in('status', ['started', 'completed']);

      // Total llamadas del centro
      const { count: totalCallsCount } = await supabase
        .from('calls')
        .select('id', { count: 'exact' })
        .in('user_id', userIds)
        .eq('status', 'completed');

      // Duración promedio
      const { data: callsData } = await supabase
        .from('calls')
        .select('duration_seconds')
        .in('user_id', userIds)
        .eq('status', 'completed')
        .not('duration_seconds', 'is', null);

      let avgDuration = 0;
      if (callsData && callsData.length > 0) {
        const total = callsData.reduce((acc, call) => acc + (call.duration_seconds || 0), 0);
        avgDuration = Math.floor(total / callsData.length);
      }

      setStats({
        totalUsers: usersCount || 0,
        callsToday: callsTodayCount || 0,
        totalManagers: 0,
        totalCenters: 0,
        totalCalls: totalCallsCount || 0,
        avgCallDuration: avgDuration,
      });

    } catch (err: any) {
      console.error('Error loading manager stats:', err);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  if (loading) {
    return (
      <DashboardLayout profile={profile ? { 
        email: profile.email, 
        role: profile.role, 
        center_id: profile.center_id || undefined 
      } : undefined}>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout profile={profile ? { 
      email: profile.email, 
      role: profile.role, 
      center_id: profile.center_id || undefined 
    } : undefined}>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">
              Bienvenido, {profile?.email}
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 mt-2">
              {profile?.role === 'admin' ? 'Panel de Administración' : 'Panel de Gestión'}
            </p>
          </div>
          {profile?.role === 'admin' && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push('/dashboard/admins')}
              className="w-full sm:w-auto"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="hidden sm:inline">Gestionar Admins</span>
              <span className="sm:hidden">Admins</span>
            </Button>
          )}
        </div>

        {/* Estadísticas - MÁS COMPACTAS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Total Usuarios */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-white/20 rounded-md backdrop-blur-sm">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-blue-100 mb-1">Usuarios</p>
            <p className="text-2xl sm:text-3xl font-bold text-white">{stats.totalUsers}</p>
          </div>

          {/* Llamadas Hoy */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-white/20 rounded-md backdrop-blur-sm">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-green-100 mb-1">Hoy</p>
            <p className="text-2xl sm:text-3xl font-bold text-white">{stats.callsToday}</p>
          </div>

          {/* Total Llamadas */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-white/20 rounded-md backdrop-blur-sm">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-purple-100 mb-1">Llamadas</p>
            <p className="text-2xl sm:text-3xl font-bold text-white">{stats.totalCalls}</p>
          </div>

          {/* Duración Promedio */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-white/20 rounded-md backdrop-blur-sm">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-orange-100 mb-1">Promedio</p>
            <p className="text-xl sm:text-2xl font-bold text-white">{formatDuration(stats.avgCallDuration)}</p>
          </div>

          {/* Managers (solo para admins) */}
          {profile?.role === 'admin' && (
            <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg shadow-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-md backdrop-blur-sm">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-pink-100 mb-1">Gestores</p>
              <p className="text-2xl sm:text-3xl font-bold text-white">{stats.totalManagers}</p>
            </div>
          )}

          {/* Centros (solo para admins) */}
          {profile?.role === 'admin' && (
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-md backdrop-blur-sm">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-indigo-100 mb-1">Centros</p>
              <p className="text-2xl sm:text-3xl font-bold text-white">{stats.totalCenters}</p>
            </div>
          )}
        </div>

        {/* Accesos Rápidos - MÁS PROMINENTES */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-blue-500 to-blue-600 border-b-2 border-blue-700">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Accesos Rápidos</h2>
          </div>

          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Gestionar Usuarios */}
              <button
                onClick={() => router.push('/dashboard/usuarios')}
                className="group flex items-start gap-4 p-6 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl transition-all duration-200 shadow-md hover:shadow-xl text-left border-2 border-transparent hover:border-blue-300"
              >
                <div className="p-3 bg-blue-500 rounded-lg group-hover:scale-110 transition-transform shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Gestionar Usuarios</h3>
                  <p className="text-sm text-gray-600">Ver y administrar todos los usuarios del centro</p>
                </div>
              </button>

              {/* Gestionar Centros (solo admins) */}
              {profile?.role === 'admin' && (
                <button
                  onClick={() => router.push('/dashboard/centros')}
                  className="group flex items-start gap-4 p-6 bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-xl transition-all duration-200 shadow-md hover:shadow-xl text-left border-2 border-transparent hover:border-green-300"
                >
                  <div className="p-3 bg-green-500 rounded-lg group-hover:scale-110 transition-transform shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Gestionar Centros</h3>
                    <p className="text-sm text-gray-600">Administrar todos los centros del sistema</p>
                  </div>
                </button>
              )}

              {/* Gestionar Administradores (solo admins) */}
              {profile?.role === 'admin' && (
                <button
                  onClick={() => router.push('/dashboard/admins')}
                  className="group flex items-start gap-4 p-6 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl transition-all duration-200 shadow-md hover:shadow-xl text-left border-2 border-transparent hover:border-purple-300"
                >
                  <div className="p-3 bg-purple-500 rounded-lg group-hover:scale-110 transition-transform shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Administradores</h3>
                    <p className="text-sm text-gray-600">Gestionar admins y managers del sistema</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}