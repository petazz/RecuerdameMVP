'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CreateUserForm } from '@/components/CreateUserForm';
import { UsersList } from '@/components/UsersList';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'manager';
  center_id?: string | null;
}

interface User {
  id: string;
  full_name: string;
  email?: string;
  login_token: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    fetchProfileAndUsers();
  }, [router]);

  const fetchProfileAndUsers = async () => {
    setLoading(true);
    try {
      // Obtener usuario autenticado
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData?.user) {
        router.replace('/login');
        return;
      }

      // Obtener perfil del usuario
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role, center_id')
        .eq('id', userData.user.id)
        .single();

      if (profileError || !profileData) {
        setError('No autorizado o perfil no encontrado');
        router.replace('/login');
        return;
      }

      setProfile(profileData);

      // Si tiene centro asignado, cargar usuarios
      if (profileData.center_id) {
        await fetchUsers(profileData.center_id);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (centerId: string) => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('center_id', centerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar usuarios');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleUserCreated = () => {
    if (profile?.center_id) {
      fetchUsers(profile.center_id);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;

    if (profile?.center_id) {
      await fetchUsers(profile.center_id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <svg
            className="w-16 h-16 mx-auto text-red-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-lg text-red-600">{error}</p>
        </div>
      </div>
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
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Bienvenido al Panel</h1>
          <p className="text-xl text-gray-600">
            Gestiona los usuarios de tu centro
          </p>
        </div>

        {/* Alerta si no tiene centro */}
        {!profile?.center_id && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <svg
                className="w-8 h-8 text-yellow-600 flex-shrink-0 mt-1"
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
              <div>
                <h3 className="text-xl font-bold text-yellow-900 mb-2">
                  Centro no asignado
                </h3>
                <p className="text-lg text-yellow-800">
                  No puedes gestionar usuarios hasta que un administrador te asigne un centro.
                  Por favor, contacta con el administrador del sistema.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {profile?.center_id && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Total Usuarios"
              value={users.length.toString()}
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
              color="bg-blue-600"
            />
            <StatCard
              title="Tu Centro"
              value={profile.center_id}
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
              color="bg-green-600"
            />
            <StatCard
              title="Rol"
              value={profile.role === 'admin' ? 'Administrador' : 'Manager'}
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
              color="bg-purple-600"
            />
          </div>
        )}

        {/* Formulario de creación */}
        {profile?.center_id && (
          <CreateUserForm centerId={profile.center_id} onSuccess={handleUserCreated} />
        )}

        {/* Lista de usuarios */}
        {profile?.center_id && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Usuarios del Centro ({users.length})
            </h2>
            <UsersList users={users} loading={usersLoading} onDelete={handleDeleteUser} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 flex items-center gap-4">
      <div className={`${color} text-white p-4 rounded-lg`}>
        {icon}
      </div>
      <div>
        <p className="text-base text-gray-600 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}