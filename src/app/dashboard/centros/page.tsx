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

interface Center {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
  manager_count?: number;
  user_count?: number;
}

interface Manager {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'manager';
  center_id?: string | null;
}

// Lista completa de timezones
const TIMEZONES = [
  'UTC',
  'Europe/Madrid',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Sao_Paulo',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export default function CentrosPage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  // Centro seleccionado
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [centerManagers, setCenterManagers] = useState<Manager[]>([]);
  
  // Formularios
  const [newCenterName, setNewCenterName] = useState('');
  const [newCenterTimezone, setNewCenterTimezone] = useState('Europe/Madrid');
  const [editCenterName, setEditCenterName] = useState('');
  const [editCenterTimezone, setEditCenterTimezone] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  
  // Paginación
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetchProfileAndCenters();
  }, [page]);

  const fetchProfileAndCenters = async () => {
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
      await fetchCenters();
    } catch (err: any) {
      showToast(err.message || 'Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCenters = async () => {
    try {
      const { data, error } = await supabase
        .from('centers')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      // Enriquecer con contadores
      const enrichedCenters = await Promise.all(
        (data || []).map(async (center) => {
          const [managersRes, usersRes] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact' }).eq('center_id', center.id),
            supabase.from('users').select('id', { count: 'exact' }).eq('center_id', center.id),
          ]);

          return {
            ...center,
            manager_count: managersRes.count || 0,
            user_count: usersRes.count || 0,
          };
        })
      );

      setCenters(enrichedCenters);
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar centros', 'error');
    }
  };

  const fetchCenterManagers = async (centerId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, created_at')
        .eq('center_id', centerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCenterManagers(data || []);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar managers', 'error');
    }
  };

  const handleCreateCenter = async () => {
    if (!newCenterName.trim()) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    setCreating(true);

    try {
      const { error } = await supabase
        .from('centers')
        .insert([{
          name: newCenterName.trim(),
          timezone: newCenterTimezone,
        }]);

      if (error) throw error;

      showToast('Centro creado exitosamente', 'success');
      setNewCenterName('');
      setNewCenterTimezone('Europe/Madrid');
      setShowCreateModal(false);
      
      await fetchCenters();
    } catch (err: any) {
      showToast(err.message || 'Error al crear centro', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleEditCenter = async () => {
    if (!selectedCenter || !editCenterName.trim()) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('centers')
        .update({
          name: editCenterName.trim(),
          timezone: editCenterTimezone,
        })
        .eq('id', selectedCenter.id);

      if (error) throw error;

      showToast('Centro actualizado', 'success');
      setShowEditModal(false);
      await fetchCenters();
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar centro', 'error');
    }
  };

  const handleDeleteCenter = async () => {
    if (!selectedCenter) return;

    try {
      // Verificar si tiene managers o usuarios
      const [managersRes, usersRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }).eq('center_id', selectedCenter.id),
        supabase.from('users').select('id', { count: 'exact' }).eq('center_id', selectedCenter.id),
      ]);

      if ((managersRes.count || 0) > 0 || (usersRes.count || 0) > 0) {
        showToast('No se puede eliminar un centro con managers o usuarios asignados', 'error');
        return;
      }

      const { error } = await supabase
        .from('centers')
        .delete()
        .eq('id', selectedCenter.id);

      if (error) throw error;

      showToast('Centro eliminado', 'success');
      setShowDeleteModal(false);
      setSelectedCenter(null);
      await fetchCenters();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar centro', 'error');
    }
  };

  const handleInviteManager = async () => {
    if (!selectedCenter || !inviteEmail.trim()) {
      showToast('El email es obligatorio', 'error');
      return;
    }

    if (!inviteEmail.includes('@')) {
      showToast('Email inválido', 'error');
      return;
    }

    try {
      // Verificar si el email ya existe
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail.trim().toLowerCase())
        .single();

      if (existingProfile) {
        // Actualizar center_id del perfil existente
        const { error } = await supabase
          .from('profiles')
          .update({ center_id: selectedCenter.id })
          .eq('email', inviteEmail.trim().toLowerCase());

        if (error) throw error;
        showToast('Manager asignado al centro', 'success');
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
      await fetchCenterManagers(selectedCenter.id);
    } catch (err: any) {
      showToast(err.message || 'Error al invitar manager', 'error');
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
            <h1 className="text-4xl font-bold text-gray-900">Centros</h1>
            <p className="text-xl text-gray-600 mt-2">
              Gestiona los centros y sus managers
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowCreateModal(true)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear Centro
          </Button>
        </div>

        {/* Tabla de centros */}
        {centers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <svg className="w-24 h-24 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No hay centros</h3>
            <p className="text-lg text-gray-600">Crea tu primer centro para comenzar</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Nombre</th>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Timezone</th>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900"># Managers</th>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900"># Usuarios</th>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {centers.map((center) => (
                    <tr key={center.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-lg font-semibold text-gray-900">{center.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-base text-gray-600">{center.timezone}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-base text-gray-600">{center.manager_count || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-base text-gray-600">{center.user_count || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              setSelectedCenter(center);
                              await fetchCenterManagers(center.id);
                              setShowViewModal(true);
                            }}
                          >
                            Ver
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedCenter(center);
                              setEditCenterName(center.name);
                              setEditCenterTimezone(center.timezone);
                              setShowEditModal(true);
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setSelectedCenter(center);
                              setShowDeleteModal(true);
                            }}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
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
          </div>
        )}
      </div>

      {/* Modal: Crear Centro */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear Nuevo Centro"
        footer={
          <>
            <Button variant="primary" size="md" onClick={handleCreateCenter} loading={creating}>
              Crear Centro
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <Input
            label="Nombre del Centro *"
            type="text"
            value={newCenterName}
            onChange={(e) => setNewCenterName(e.target.value)}
            placeholder="Ej: Centro de Mayores El Roble"
            required
          />
          
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-2">
              Timezone *
            </label>
            <select
              value={newCenterTimezone}
              onChange={(e) => setNewCenterTimezone(e.target.value)}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:border-blue-500 focus:ring-blue-200"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Modal: Ver Centro */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={selectedCenter?.name || 'Centro'}
        footer={
          <>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setShowViewModal(false);
                setShowInviteModal(true);
              }}
            >
              Invitar Manager
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowViewModal(false)}>
              Cerrar
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-base text-gray-600">Nombre:</p>
              <p className="text-lg font-semibold text-gray-900">{selectedCenter?.name}</p>
            </div>
            <div>
              <p className="text-base text-gray-600">Timezone:</p>
              <p className="text-lg font-semibold text-gray-900">{selectedCenter?.timezone}</p>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Managers ({centerManagers.length})
            </h3>
            {centerManagers.length === 0 ? (
              <p className="text-base text-gray-600">No hay managers asignados</p>
            ) : (
              <div className="space-y-3">
                {centerManagers.map((manager) => (
                  <div key={manager.id} className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-base font-semibold text-gray-900">{manager.email}</p>
                    <p className="text-sm text-gray-600">
                      {manager.role === 'admin' ? 'Administrador' : 'Manager'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal: Editar Centro */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Centro"
        footer={
          <>
            <Button variant="primary" size="md" onClick={handleEditCenter}>
              Guardar Cambios
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <Input
            label="Nombre del Centro *"
            type="text"
            value={editCenterName}
            onChange={(e) => setEditCenterName(e.target.value)}
            required
          />
          
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-2">
              Timezone *
            </label>
            <select
              value={editCenterTimezone}
              onChange={(e) => setEditCenterTimezone(e.target.value)}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:border-blue-500 focus:ring-blue-200"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Modal: Eliminar Centro */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirmar Eliminación"
        footer={
          <>
            <Button variant="danger" size="md" onClick={handleDeleteCenter}>
              Sí, Eliminar
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-lg text-gray-700">
            ¿Estás seguro de que deseas eliminar el centro <strong>{selectedCenter?.name}</strong>?
          </p>
          <p className="text-base text-red-600 font-medium">
            ⚠️ Solo se puede eliminar si no tiene managers ni usuarios asignados.
          </p>
        </div>
      </Modal>

      {/* Modal: Invitar Manager */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invitar Manager"
        footer={
          <>
            <Button variant="primary" size="md" onClick={handleInviteManager}>
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
            </p>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}