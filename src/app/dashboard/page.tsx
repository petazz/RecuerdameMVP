'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/ToastContext';

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'manager';
  center_id?: string | null;
}

interface Center {
  id: string;
  name: string;
  timezone: string;
}

interface Manager {
  id: string;
  email: string;
  role: string;
}

interface Stats {
  totalUsers: number;
  totalManagers: number;
  callsToday: number;
  callsThisMonth: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [center, setCenter] = useState<Center | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalManagers: 0,
    callsToday: 0,
    callsThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  
  // Modal invitar manager
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 1. Obtener usuario autenticado
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        router.replace('/login');
        return;
      }

      // 2. Obtener perfil
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

      if (!profileData.center_id) {
        setLoading(false);
        return;
      }

      // 3. Obtener centro
      const { data: centerData } = await supabase
        .from('centers')
        .select('id, name, timezone')
        .eq('id', profileData.center_id)
        .single();

      setCenter(centerData);

      // 4. Obtener managers del centro
      const { data: managersData } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('center_id', profileData.center_id);

      setManagers(managersData || []);

      // 5. Obtener estadísticas
      await fetchStats(profileData.center_id, centerData?.timezone || 'Europe/Madrid');

    } catch (err: any) {
      showToast(err.message || 'Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (centerId: string, timezone: string) => {
    try {
      // Total usuarios
      const { count: usersCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('center_id', centerId);

      // Total managers
      const { count: managersCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('center_id', centerId);

      // Calcular inicio del día
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const todayStr = formatter.format(now);
      const startOfDayLocal = new Date(`${todayStr}T00:00:00`);
      
      const tempDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const offsetMs = utcDate.getTime() - tempDate.getTime();
      const startOfDayUTC = new Date(startOfDayLocal.getTime() + offsetMs);

      // Llamadas hoy
      const { count: callsTodayCount } = await supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('center_id', centerId)
        .gte('started_at', startOfDayUTC.toISOString());

      // Llamadas este mes
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const { count: callsMonthCount } = await supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('center_id', centerId)
        .gte('started_at', startOfMonth.toISOString());

      setStats({
        totalUsers: usersCount || 0,
        totalManagers: managersCount || 0,
        callsToday: callsTodayCount || 0,
        callsThisMonth: callsMonthCount || 0,
      });

    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleInviteManager = async () => {
    if (!inviteEmail.trim()) {
      showToast('El email es obligatorio', 'error');
      return;
    }

    if (!inviteEmail.includes('@')) {
      showToast('Email inválido', 'error');
      return;
    }

    if (!profile?.center_id) {
      showToast('No tienes un centro asignado', 'error');
      return;
    }

    setInviting(true);

    try {
      // Verificar si el email ya existe en profiles
      const { data: existingProfile, error: searchError } = await supabase
        .from('profiles')
        .select('id, email, center_id')
        .eq('email', inviteEmail.trim().toLowerCase())
        .single();

      if (searchError && searchError.code !== 'PGRST116') {
        throw searchError;
      }

      if (existingProfile) {
        // El usuario ya existe
        if (existingProfile.center_id) {
          showToast('Este usuario ya está asignado a un centro', 'error');
          return;
        }

        // Asignar el centro al usuario existente
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ center_id: profile.center_id })
          .eq('id', existingProfile.id);

        if (updateError) throw updateError;

        showToast('Manager asignado al centro exitosamente', 'success');
      } else {
        // El usuario no existe
        showToast(
          'El usuario no existe. Debe registrarse primero en /register',
          'warning'
        );
        setShowInviteModal(false);
        return;
      }

      setInviteEmail('');
      setShowInviteModal(false);
      
      // Refrescar lista de managers
      const { data: managersData } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('center_id', profile.center_id);

      setManagers(managersData || []);

    } catch (err: any) {
      showToast(err.message || 'Error al invitar manager', 'error');
    } finally {
      setInviting(false);
    }
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

  return (
    <DashboardLayout profile={profile ? { 
      email: profile.email, 
      role: profile.role, 
      center_id: profile.center_id || undefined 
    } : undefined}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-xl text-gray-600 mt-2">
              Bienvenido al panel de gestión
            </p>
          </div>
          {profile?.center_id && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowInviteModal(true)}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Invitar Manager
            </Button>
          )}
        </div>

        {/* Alerta si no tiene centro */}
        {!profile?.center_id && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-6">
            <p className="text-xl text-yellow-800">
              ⚠️ No tienes un centro asignado. Contacta con un administrador.
            </p>
          </div>
        )}

        {/* Stats Cards */}
        {profile?.center_id && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Usuarios"
              value={stats.totalUsers}
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              color="blue"
            />
            <StatCard
              title="Managers"
              value={stats.totalManagers}
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
              color="green"
            />
            <StatCard
              title="Llamadas Hoy"
              value={stats.callsToday}
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              }
              color="purple"
            />
            <StatCard
              title="Llamadas Este Mes"
              value={stats.callsThisMonth}
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
              color="orange"
            />
          </div>
        )}

        {/* Info del Centro y Managers */}
        {profile?.center_id && center && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Info del Centro */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Tu Centro</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Nombre</p>
                  <p className="text-xl font-semibold text-gray-900">{center.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Timezone</p>
                  <p className="text-lg text-gray-800">{center.timezone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tu Rol</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                    profile.role === 'admin' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {profile.role === 'admin' ? 'Administrador' : 'Manager'}
                  </span>
                </div>
              </div>
            </div>

            {/* Lista de Managers */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Managers del Centro</h2>
                <span className="text-sm text-gray-600">{managers.length} total</span>
              </div>
              
              {managers.length === 0 ? (
                <p className="text-gray-600">No hay managers asignados</p>
              ) : (
                <div className="space-y-3">
                  {managers.map((manager) => (
                    <div
                      key={manager.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {manager.email[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{manager.email}</p>
                        <p className="text-sm text-gray-600">
                          {manager.role === 'admin' ? 'Administrador' : 'Manager'}
                        </p>
                      </div>
                      {manager.id === profile.id && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          Tú
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Accesos Rápidos */}
        {profile?.center_id && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Accesos Rápidos</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => router.push('/dashboard/usuarios')}
                className="w-full justify-start"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Gestionar Usuarios
              </Button>
              {profile.role === 'admin' && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => router.push('/dashboard/centros')}
                  className="w-full justify-start"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Gestionar Centros
                </Button>
              )}
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setShowInviteModal(true)}
                className="w-full justify-start"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invitar Manager
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Invitar Manager */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invitar Manager"
        footer={
          <>
            <Button variant="primary" size="md" onClick={handleInviteManager} loading={inviting}>
              Enviar Invitación
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowInviteModal(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <Input
            label="Email del Manager *"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="manager@ejemplo.com"
            helperText="El usuario debe haberse registrado previamente en /register"
            required
          />
          
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> Se asignará este centro al perfil existente del manager.
              Si el usuario no existe, deberá registrarse primero.
            </p>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

// Componente StatCard
function StatCard({ 
  title, 
  value, 
  icon, 
  color 
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode; 
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}