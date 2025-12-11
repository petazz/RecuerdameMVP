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

interface Admin {
  id: string;
  email: string;
  role: string;
  center_id: string | null;
  created_at: string;
  centers?: {
    name: string;
  } | null;
}

interface Manager {
  id: string;
  email: string;
  role: string;
  center_id: string | null;
  created_at: string;
  centers?: {
    name: string;
  } | null;
}

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'manager';
  center_id?: string | null;
}

interface Center {
  id: string;
  name: string;
}

export default function AdminsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'admins' | 'managers'>('admins');
  
  // Modales
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  
  // Usuario seleccionado
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  
  // Formularios
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [editCenterId, setEditCenterId] = useState<string>('');
  
  // Paginación
  const [adminPage, setAdminPage] = useState(0);
  const [managerPage, setManagerPage] = useState(0);
  const [hasMoreAdmins, setHasMoreAdmins] = useState(true);
  const [hasMoreManagers, setHasMoreManagers] = useState(true);
  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchProfileAndData();
  }, [adminPage, managerPage]);

  const fetchProfileAndData = async () => {
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

      if (profileData.role !== 'admin') {
        showToast('No tienes permisos para acceder a esta página', 'error');
        router.replace('/dashboard');
        return;
      }

      setProfile(profileData);

      // Cargar centros para el selector
      const { data: centersData } = await supabase
        .from('centers')
        .select('id, name')
        .order('name', { ascending: true });

      setCenters(centersData || []);

      await Promise.all([fetchAdmins(), fetchManagers()]);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          role,
          center_id,
          created_at,
          centers (
            name
          )
        `)
        .eq('role', 'admin')
        .order('created_at', { ascending: false })
        .range(adminPage * PAGE_SIZE, (adminPage + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      setAdmins((data as unknown as Admin[]) || []);
      setHasMoreAdmins((data || []).length === PAGE_SIZE);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar administradores', 'error');
    }
  };

  const fetchManagers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          role,
          center_id,
          created_at,
          centers (
            name
          )
        `)
        .eq('role', 'manager')
        .order('created_at', { ascending: false })
        .range(managerPage * PAGE_SIZE, (managerPage + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      setManagers((data as unknown as Manager[]) || []);
      setHasMoreManagers((data || []).length === PAGE_SIZE);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar managers', 'error');
    }
  };

  const handleInviteAdmin = async () => {
    if (!inviteEmail.trim()) {
      showToast('El email es obligatorio', 'error');
      return;
    }

    if (!inviteEmail.includes('@')) {
      showToast('Email inválido', 'error');
      return;
    }

    setInviting(true);

    try {
      // Verificar si el email ya existe
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('email', inviteEmail.trim().toLowerCase())
        .single();

      if (existingProfile) {
        // Actualizar el rol a admin
        const { error } = await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('email', inviteEmail.trim().toLowerCase());

        if (error) throw error;
        showToast('Usuario actualizado a Administrador', 'success');
      } else {
        showToast(
          'El usuario no existe. Debe registrarse primero en /register',
          'warning'
        );
        setShowInviteModal(false);
        return;
      }

      setInviteEmail('');
      setShowInviteModal(false);
      await Promise.all([fetchAdmins(), fetchManagers()]);
    } catch (err: any) {
      showToast(err.message || 'Error al invitar administrador', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleEditAdmin = async () => {
    if (!selectedAdmin) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          center_id: editCenterId || null,
        })
        .eq('id', selectedAdmin.id);

      if (error) throw error;

      showToast('Administrador actualizado', 'success');
      setShowEditModal(false);
      await fetchAdmins();
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar administrador', 'error');
    }
  };

  const handleEditManager = async () => {
    if (!selectedManager) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          center_id: editCenterId || null,
        })
        .eq('id', selectedManager.id);

      if (error) throw error;

      showToast('Manager actualizado', 'success');
      setShowEditModal(false);
      await fetchManagers();
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar manager', 'error');
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;

    try {
      // Cambiar rol a manager en lugar de eliminar
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'manager' })
        .eq('id', selectedAdmin.id);

      if (error) throw error;

      showToast('Privilegios de administrador removidos', 'success');
      setShowDeleteModal(false);
      setSelectedAdmin(null);
      await Promise.all([fetchAdmins(), fetchManagers()]);
    } catch (err: any) {
      showToast(err.message || 'Error al remover administrador', 'error');
    }
  };

  const handlePromoteManager = async () => {
    if (!selectedManager) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', selectedManager.id);

      if (error) throw error;

      showToast('Manager promovido a Administrador', 'success');
      setShowPromoteModal(false);
      setSelectedManager(null);
      await Promise.all([fetchAdmins(), fetchManagers()]);
    } catch (err: any) {
      showToast(err.message || 'Error al promover manager', 'error');
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
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Administración de Usuarios</h1>
            <p className="text-lg sm:text-xl text-gray-600 mt-2">
              Gestiona administradores y managers del sistema
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowInviteModal(true)}
            className="w-full sm:w-auto"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Añadir Admin</span>
            <span className="sm:hidden">Añadir</span>
          </Button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="border-b-2 border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('admins')}
                className={`flex-1 px-4 sm:px-6 py-4 text-base sm:text-lg font-semibold transition-colors ${
                  activeTab === 'admins'
                    ? 'bg-purple-50 text-purple-700 border-b-4 border-purple-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Administradores</span>
                  <span className="ml-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-bold">
                    {admins.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('managers')}
                className={`flex-1 px-4 sm:px-6 py-4 text-base sm:text-lg font-semibold transition-colors ${
                  activeTab === 'managers'
                    ? 'bg-blue-50 text-blue-700 border-b-4 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Managers</span>
                  <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                    {managers.length}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Contenido de Administradores */}
          {activeTab === 'admins' && (
            <>
              {admins.length === 0 ? (
                <div className="p-8 sm:p-12 text-center">
                  <svg className="w-16 h-16 sm:w-24 sm:h-24 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No hay administradores</h3>
                  <p className="text-base sm:text-lg text-gray-600">Añade tu primer administrador para comenzar</p>
                </div>
              ) : (
                <>
                  {/* Vista móvil - Cards */}
                  <div className="block lg:hidden divide-y divide-gray-200">
                    {admins.map((admin) => (
                      <div key={admin.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                            {admin.email[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-gray-900 truncate">{admin.email}</p>
                            {admin.id === profile?.id && (
                              <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full mt-1">
                                Tú
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Centro:</span>
                            <span className="font-medium text-gray-900">
                              {admin.centers ? (admin.centers as any).name : 'Sin asignar'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Creado:</span>
                            <span className="font-medium text-gray-900">
                              {new Date(admin.created_at).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedAdmin(admin);
                              setEditCenterId(admin.center_id || '');
                              setShowEditModal(true);
                            }}
                            className="flex-1"
                          >
                            Editar
                          </Button>
                          {admin.id !== profile?.id && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                setSelectedAdmin(admin);
                                setShowDeleteModal(true);
                              }}
                              className="flex-1"
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Vista desktop - Tabla */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Email</th>
                          <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Centro Asignado</th>
                          <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Fecha de Creación</th>
                          <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {admins.map((admin) => (
                          <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                                  {admin.email[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-lg font-semibold text-gray-900">{admin.email}</p>
                                  {admin.id === profile?.id && (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                      Tú
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-base text-gray-600">
                                {admin.centers ? (admin.centers as any).name : 'Sin centro asignado'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-base text-gray-600">
                                {new Date(admin.created_at).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedAdmin(admin);
                                    setEditCenterId(admin.center_id || '');
                                    setShowEditModal(true);
                                  }}
                                >
                                  Editar
                                </Button>
                                {admin.id !== profile?.id && (
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedAdmin(admin);
                                      setShowDeleteModal(true);
                                    }}
                                  >
                                    Remover
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t-2 border-gray-200">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setAdminPage(p => Math.max(0, p - 1))}
                      disabled={adminPage === 0}
                      className="w-full sm:w-auto"
                    >
                      Anterior
                    </Button>
                    <span className="text-base sm:text-lg text-gray-600">Página {adminPage + 1}</span>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setAdminPage(p => p + 1)}
                      disabled={!hasMoreAdmins}
                      className="w-full sm:w-auto"
                    >
                      Siguiente
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Contenido de Managers */}
          {activeTab === 'managers' && (
            <>
              {managers.length === 0 ? (
                <div className="p-8 sm:p-12 text-center">
                  <svg className="w-16 h-16 sm:w-24 sm:h-24 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No hay managers</h3>
                  <p className="text-base sm:text-lg text-gray-600">Los managers aparecerán aquí cuando se registren</p>
                </div>
              ) : (
                <>
                  {/* Vista móvil - Cards */}
                  <div className="block lg:hidden divide-y divide-gray-200">
                    {managers.map((manager) => (
                      <div key={manager.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                            {manager.email[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-gray-900 truncate">{manager.email}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Centro:</span>
                            <span className="font-medium text-gray-900">
                              {manager.centers ? (manager.centers as any).name : 'Sin asignar'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Creado:</span>
                            <span className="font-medium text-gray-900">
                              {new Date(manager.created_at).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedManager(manager);
                              setEditCenterId(manager.center_id || '');
                              setShowEditModal(true);
                            }}
                            className="flex-1"
                          >
                            Editar
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedManager(manager);
                              setShowPromoteModal(true);
                            }}
                            className="flex-1"
                          >
                            Promover a Admin
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Vista desktop - Tabla */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Email</th>
                          <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Centro Asignado</th>
                          <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Fecha de Creación</th>
                          <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {managers.map((manager) => (
                          <tr key={manager.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                                  {manager.email[0].toUpperCase()}
                                </div>
                                <p className="text-lg font-semibold text-gray-900">{manager.email}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-base text-gray-600">
                                {manager.centers ? (manager.centers as any).name : 'Sin centro asignado'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-base text-gray-600">
                                {new Date(manager.created_at).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedManager(manager);
                                    setEditCenterId(manager.center_id || '');
                                    setShowEditModal(true);
                                  }}
                                >
                                  Editar
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedManager(manager);
                                    setShowPromoteModal(true);
                                  }}
                                >
                                  Promover a Admin
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t-2 border-gray-200">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setManagerPage(p => Math.max(0, p - 1))}
                      disabled={managerPage === 0}
                      className="w-full sm:w-auto"
                    >
                      Anterior
                    </Button>
                    <span className="text-base sm:text-lg text-gray-600">Página {managerPage + 1}</span>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setManagerPage(p => p + 1)}
                      disabled={!hasMoreManagers}
                      className="w-full sm:w-auto"
                    >
                      Siguiente
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal: Invitar Administrador */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Añadir Administrador"
        footer={
          <>
            <Button variant="primary" size="md" onClick={handleInviteAdmin} loading={inviting}>
              Añadir
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowInviteModal(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <Input
            label="Email del Usuario *"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="admin@ejemplo.com"
            helperText="El usuario debe haberse registrado previamente en /register"
            required
          />
          
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-800">
              <strong>Nota:</strong> Se actualizará el rol del usuario a Administrador.
              Si el usuario no existe, deberá registrarse primero.
            </p>
          </div>
        </div>
      </Modal>

      {/* Modal: Editar (Admin o Manager) */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={selectedAdmin ? "Editar Administrador" : "Editar Manager"}
        footer={
          <>
            <Button 
              variant="primary" 
              size="md" 
              onClick={selectedAdmin ? handleEditAdmin : handleEditManager}
            >
              Guardar Cambios
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <p className="text-base text-gray-700 mb-4">
              <strong>Email:</strong> {selectedAdmin?.email || selectedManager?.email}
            </p>
          </div>

          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-2">
              Centro Asignado
            </label>
            <select
              value={editCenterId}
              onChange={(e) => setEditCenterId(e.target.value)}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:border-blue-500 focus:ring-blue-200"
            >
              <option value="">Sin centro asignado</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Modal: Remover Administrador */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirmar Acción"
        footer={
          <>
            <Button variant="danger" size="md" onClick={handleDeleteAdmin}>
              Sí, Remover
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-lg text-gray-700">
            ¿Estás seguro de que deseas remover privilegios de administrador a{' '}
            <strong>{selectedAdmin?.email}</strong>?
          </p>
          <p className="text-base text-orange-600 font-medium">
            ⚠️ El usuario se convertirá en Manager pero mantendrá su acceso al sistema.
          </p>
        </div>
      </Modal>

      {/* Modal: Promover Manager */}
      <Modal
        isOpen={showPromoteModal}
        onClose={() => setShowPromoteModal(false)}
        title="Promover a Administrador"
        footer={
          <>
            <Button variant="primary" size="md" onClick={handlePromoteManager}>
              Sí, Promover
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowPromoteModal(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-lg text-gray-700">
            ¿Estás seguro de que deseas promover a{' '}
            <strong>{selectedManager?.email}</strong> a Administrador?
          </p>
          <p className="text-base text-blue-600 font-medium">
            ✅ El usuario tendrá acceso completo a todas las funciones de administración.
          </p>
        </div>
      </Modal>
    </DashboardLayout>
  );
}