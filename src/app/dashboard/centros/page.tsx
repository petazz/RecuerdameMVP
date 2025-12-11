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
  address: string;
  timezone: string;
  created_at: string;
  total_users: number;
  active_managers: number;
}

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'manager';
  center_id?: string | null;
}

const TIMEZONES = [
  'Europe/Madrid',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'America/Mexico_City',
];

export default function CentrosPage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  
  // Centro seleccionado
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  
  // Formularios
  const [centerName, setCenterName] = useState('');
  const [centerAddress, setCenterAddress] = useState('');
  const [centerTimezone, setCenterTimezone] = useState('Europe/Madrid');
  
  // Paginación
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (profile) {
      fetchCenters();
    }
  }, [page, profile]);

  const checkAuth = async () => {
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

      if (profileError || !profileData || profileData.role !== 'admin') {
        showToast('No tienes permisos para acceder a esta página', 'error');
        router.replace('/dashboard');
        return;
      }

      setProfile(profileData);
    } catch (err: any) {
      showToast(err.message || 'Error de autenticación', 'error');
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchCenters = async () => {
    try {
      const { data: centersData, error: centersError } = await supabase
        .from('centers')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (centersError) throw centersError;

      const enrichedCenters = await Promise.all(
        (centersData || []).map(async (center) => {
          const { count: userCount } = await supabase
            .from('users')
            .select('id', { count: 'exact' })
            .eq('center_id', center.id);

          const { count: managerCount } = await supabase
            .from('profiles')
            .select('id', { count: 'exact' })
            .eq('center_id', center.id)
            .in('role', ['manager', 'admin']);

          return {
            ...center,
            total_users: userCount || 0,
            active_managers: managerCount || 0,
          };
        })
      );

      setCenters(enrichedCenters);
      setHasMore((centersData || []).length === PAGE_SIZE);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar centros', 'error');
    }
  };

  const handleCreateCenter = async () => {
    if (!centerName.trim() || !centerAddress.trim()) {
      showToast('Todos los campos son obligatorios', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('centers')
        .insert([{
          name: centerName.trim(),
          address: centerAddress.trim(),
          timezone: centerTimezone,
        }]);

      if (error) throw error;

      showToast('Centro creado exitosamente', 'success');
      setCenterName('');
      setCenterAddress('');
      setCenterTimezone('Europe/Madrid');
      setShowCreateModal(false);
      await fetchCenters();
    } catch (err: any) {
      showToast(err.message || 'Error al crear centro', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCenter = async () => {
    if (!selectedCenter || !centerName.trim() || !centerAddress.trim()) {
      showToast('Todos los campos son obligatorios', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('centers')
        .update({
          name: centerName.trim(),
          address: centerAddress.trim(),
          timezone: centerTimezone,
        })
        .eq('id', selectedCenter.id);

      if (error) throw error;

      showToast('Centro actualizado', 'success');
      setShowEditModal(false);
      await fetchCenters();
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar centro', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCenter = async () => {
    if (!selectedCenter) return;

    setSubmitting(true);

    try {
      const { count: userCount } = await supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('center_id', selectedCenter.id);

      if (userCount && userCount > 0) {
        showToast('No se puede eliminar un centro con usuarios', 'error');
        setSubmitting(false);
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
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (center: Center) => {
    setSelectedCenter(center);
    setCenterName(center.name);
    setCenterAddress(center.address);
    setCenterTimezone(center.timezone);
    setShowEditModal(true);
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
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Centros</h1>
            <p className="text-lg sm:text-xl text-gray-600 mt-2">
              Gestiona todos los centros del sistema
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Crear Centro</span>
            <span className="sm:hidden">Crear</span>
          </Button>
        </div>

        {/* Lista de centros */}
        {centers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 sm:p-12 text-center">
            <svg className="w-16 h-16 sm:w-24 sm:h-24 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No hay centros</h3>
            <p className="text-base sm:text-lg text-gray-600">Crea tu primer centro para comenzar</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Vista móvil - Cards */}
            <div className="block lg:hidden divide-y divide-gray-200">
              {centers.map((center) => (
                <div key={center.id} className="p-4 hover:bg-gray-50">
                  <div className="mb-3">
                    <h3 className="text-lg font-bold text-gray-900">{center.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{center.address}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="text-xs text-blue-900 font-medium">Usuarios</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700">{center.total_users}</p>
                    </div>

                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span className="text-xs text-green-900 font-medium">Gestores</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700">{center.active_managers}</p>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {center.timezone}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedCenter(center);
                        setShowStatsModal(true);
                      }}
                      className="w-full"
                    >
                      Ver
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditModal(center)}
                      className="w-full"
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
                      className="w-full"
                      disabled={center.total_users > 0}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Vista desktop - Tabla */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Centro</th>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Dirección</th>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Zona Horaria</th>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Usuarios</th>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Gestores</th>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {centers.map((center) => (
                    <tr key={center.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-lg font-semibold text-gray-900">{center.name}</p>
                        <p className="text-sm text-gray-500">
                          Creado: {new Date(center.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-base text-gray-700">{center.address}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-base text-gray-600">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {center.timezone}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-base font-semibold">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {center.total_users}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-base font-semibold">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {center.active_managers}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedCenter(center);
                              setShowStatsModal(true);
                            }}
                          >
                            Ver Detalles
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditModal(center)}
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
                            disabled={center.total_users > 0}
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t-2 border-gray-200">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-full sm:w-auto"
              >
                Anterior
              </Button>
              <span className="text-base sm:text-lg text-gray-600">Página {page + 1}</span>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setPage(p => p + 1)}
                disabled={!hasMore}
                className="w-full sm:w-auto"
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
            <Button variant="primary" size="md" onClick={handleCreateCenter} loading={submitting}>
              Crear Centro
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre del Centro *"
            type="text"
            value={centerName}
            onChange={(e) => setCenterName(e.target.value)}
            placeholder="Ej: Residencia San José"
            required
          />
          <Input
            label="Dirección *"
            type="text"
            value={centerAddress}
            onChange={(e) => setCenterAddress(e.target.value)}
            placeholder="Ej: Calle Mayor 123, Madrid"
            required
          />
          <div>
            <label className="block text-base font-semibold text-gray-900 mb-2">
              Zona Horaria *
            </label>
            <select
              value={centerTimezone}
              onChange={(e) => setCenterTimezone(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
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
            <Button variant="primary" size="md" onClick={handleEditCenter} loading={submitting}>
              Guardar Cambios
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre del Centro *"
            type="text"
            value={centerName}
            onChange={(e) => setCenterName(e.target.value)}
            required
          />
          <Input
            label="Dirección *"
            type="text"
            value={centerAddress}
            onChange={(e) => setCenterAddress(e.target.value)}
            required
          />
          <div>
            <label className="block text-base font-semibold text-gray-900 mb-2">
              Zona Horaria *
            </label>
            <select
              value={centerTimezone}
              onChange={(e) => setCenterTimezone(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        title="Eliminar Centro"
        footer={
          <>
            <Button variant="danger" size="md" onClick={handleDeleteCenter} loading={submitting}>
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
            ¿Eliminar el centro <strong>{selectedCenter?.name}</strong>?
          </p>
          {selectedCenter && selectedCenter.total_users > 0 ? (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-base text-red-800 font-semibold">
                ⚠️ No se puede eliminar este centro porque tiene {selectedCenter.total_users} usuario(s) asignado(s).
              </p>
            </div>
          ) : (
            <p className="text-base text-red-600">
              ⚠️ Esta acción no se puede deshacer.
            </p>
          )}
        </div>
      </Modal>

      {/* Modal: Ver Estadísticas */}
      <Modal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        title={selectedCenter?.name || 'Detalles del Centro'}
        footer={
          <Button variant="secondary" size="md" onClick={() => setShowStatsModal(false)}>
            Cerrar
          </Button>
        }
      >
        {selectedCenter && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-gray-700 mb-1">Dirección</h3>
              <p className="text-lg text-gray-900">{selectedCenter.address}</p>
            </div>
            
            <div>
              <h3 className="text-base font-semibold text-gray-700 mb-1">Zona Horaria</h3>
              <p className="text-lg text-gray-900">{selectedCenter.timezone}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-sm text-blue-900 font-medium">Total Usuarios</span>
                </div>
                <p className="text-3xl font-bold text-blue-700">{selectedCenter.total_users}</p>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="text-sm text-green-900 font-medium">Gestores Activos</span>
                </div>
                <p className="text-3xl font-bold text-green-700">{selectedCenter.active_managers}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Creado el {new Date(selectedCenter.created_at).toLocaleDateString('es-ES', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}