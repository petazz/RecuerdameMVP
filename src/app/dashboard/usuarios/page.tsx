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
import { QRCodeCanvas } from 'qrcode.react';

interface User {
  id: string;
  full_name: string;
  login_token: string;
  center_id: string;
  created_at: string;
  calls_today: number;
  last_call_at: string | null;
}

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'manager';
  center_id?: string | null;
}

export default function UsuariosPage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  
  // Usuario seleccionado
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Formularios
  const [newUserName, setNewUserName] = useState('');
  const [editUserName, setEditUserName] = useState('');
  
  // Paginación
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetchProfileAndUsers();
  }, [page]);

  const fetchProfileAndUsers = async () => {
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

      if (!profileData.center_id) {
        showToast('No tienes un centro asignado', 'warning');
        setLoading(false);
        return;
      }

      await fetchUsers(profileData.center_id);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (centerId: string) => {
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('center_id', centerId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (usersError) throw usersError;

      const { data: centerData } = await supabase
        .from('centers')
        .select('timezone')
        .eq('id', centerId)
        .single();

      const timezone = centerData?.timezone || 'Europe/Madrid';

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

      const enrichedUsers = await Promise.all(
        (usersData || []).map(async (user) => {
          const { data: todayCalls } = await supabase
            .from('calls')
            .select('id', { count: 'exact' })
            .eq('user_id', user.id)
            .in('status', ['started', 'completed'])
            .gte('started_at', startOfDayUTC.toISOString());

          const { data: lastCall } = await supabase
            .from('calls')
            .select('started_at')
            .eq('user_id', user.id)
            .in('status', ['started', 'completed'])
            .order('started_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...user,
            calls_today: todayCalls?.length || 0,
            last_call_at: lastCall?.started_at || null,
          };
        })
      );

      setUsers(enrichedUsers);
      setHasMore((usersData || []).length === PAGE_SIZE);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar usuarios', 'error');
    }
  };

  const generateToken = () => {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim()) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    if (!profile?.center_id) {
      showToast('No tienes un centro asignado', 'error');
      return;
    }

    setCreating(true);

    try {
      const token = generateToken();

      const { data, error } = await supabase
        .from('users')
        .insert([{
          center_id: profile.center_id,
          full_name: newUserName.trim(),
          login_token: token,
        }])
        .select()
        .single();

      if (error) throw error;

      setSelectedUser({ ...data, calls_today: 0, last_call_at: null });
      
      showToast('Usuario creado exitosamente', 'success');
      setNewUserName('');
      setShowCreateModal(false);
      setShowQRModal(true);
      
      await fetchUsers(profile.center_id);
    } catch (err: any) {
      showToast(err.message || 'Error al crear usuario', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser || !editUserName.trim()) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: editUserName.trim() })
        .eq('id', selectedUser.id);

      if (error) throw error;

      showToast('Usuario actualizado', 'success');
      setShowEditModal(false);
      
      if (profile?.center_id) {
        await fetchUsers(profile.center_id);
      }
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar usuario', 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedUser.id);

      if (error) throw error;

      showToast('Usuario eliminado', 'success');
      setShowDeleteModal(false);
      setSelectedUser(null);
      
      if (profile?.center_id) {
        await fetchUsers(profile.center_id);
      }
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar usuario', 'error');
    }
  };

  const getUserUrl = (token: string) => `${window.location.origin}/u/${token}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Enlace copiado al portapapeles', 'success');
  };

  const downloadQR = () => {
    if (!selectedUser) return;
    
    const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `qr-${selectedUser.full_name.replace(/\s+/g, '-')}.png`;
    link.href = url;
    link.click();
    
    showToast('Código QR descargado', 'success');
  };

  const formatLastCall = (dateString: string | null): string => {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Hoy ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return `Hace ${diffDays} días`;
    } else {
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
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
            <h1 className="text-4xl font-bold text-gray-900">Usuarios</h1>
            <p className="text-xl text-gray-600 mt-2">
              Gestiona los usuarios de tu centro
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowCreateModal(true)}
            disabled={!profile?.center_id}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear Usuario
          </Button>
        </div>

        {!profile?.center_id && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-6">
            <p className="text-xl text-yellow-800">
              ⚠️ No tienes un centro asignado. Contacta con un administrador.
            </p>
          </div>
        )}

        {/* Tabla de usuarios */}
        {users.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <svg className="w-24 h-24 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No hay usuarios</h3>
            <p className="text-lg text-gray-600">Crea tu primer usuario para comenzar</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Nombre</th>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Llamadas Hoy</th>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Última Llamada</th>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-lg font-semibold text-gray-900">{user.full_name}</p>
                        <p className="text-sm text-gray-500">
                          Creado: {new Date(user.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-base font-semibold ${
                          user.calls_today >= 2 
                            ? 'bg-red-100 text-red-800' 
                            : user.calls_today === 1 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-green-100 text-green-800'
                        }`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {user.calls_today} / 2
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-base text-gray-600">
                          {formatLastCall(user.last_call_at)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {/* Botón QR - El más importante */}
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowQRModal(true);
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            QR
                          </Button>
                          {/* Ver historial */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/dashboard/usuarios/${user.id}`)}
                          >
                            Ver
                          </Button>
                          {/* Editar */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setEditUserName(user.full_name);
                              setShowEditModal(true);
                            }}
                          >
                            Editar
                          </Button>
                          {/* Eliminar */}
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
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

      {/* Modal: Crear Usuario */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear Nuevo Usuario"
        footer={
          <>
            <Button variant="primary" size="md" onClick={handleCreateUser} loading={creating}>
              Crear Usuario
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <Input
            label="Nombre Completo *"
            type="text"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            placeholder="Ej: Juan García López"
            required
          />
        </div>
      </Modal>

      {/* Modal: Ver QR y URL */}
      <Modal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title={`QR de ${selectedUser?.full_name}`}
        footer={
          <>
            <Button variant="primary" size="md" onClick={downloadQR}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descargar QR
            </Button>
            <Button 
              variant="secondary" 
              size="md" 
              onClick={() => selectedUser && copyToClipboard(getUserUrl(selectedUser.login_token))}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copiar Enlace
            </Button>
          </>
        }
      >
        {selectedUser && (
          <div className="flex flex-col items-center gap-6">
            <div className="bg-white p-4 rounded-xl border-4 border-gray-200 shadow-inner">
              <QRCodeCanvas
                id="qr-canvas"
                value={getUserUrl(selectedUser.login_token)}
                size={280}
                level="H"
                includeMargin={true}
              />
            </div>
            <div className="text-center w-full">
              <p className="text-base text-gray-600 mb-2">Enlace de acceso:</p>
              <code className="block px-4 py-3 bg-gray-100 rounded-lg text-sm break-all font-mono">
                {getUserUrl(selectedUser.login_token)}
              </code>
            </div>
            <div className="w-full p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 text-center">
                💡 Imprime este QR o envía el enlace al usuario para que pueda acceder
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Editar Usuario */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Usuario"
        footer={
          <>
            <Button variant="primary" size="md" onClick={handleEditUser}>
              Guardar
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <Input
          label="Nombre Completo *"
          type="text"
          value={editUserName}
          onChange={(e) => setEditUserName(e.target.value)}
          required
        />
      </Modal>

      {/* Modal: Eliminar Usuario */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Eliminar Usuario"
        footer={
          <>
            <Button variant="danger" size="md" onClick={handleDeleteUser}>
              Sí, Eliminar
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <p className="text-lg text-gray-700">
          ¿Eliminar a <strong>{selectedUser?.full_name}</strong>?
        </p>
        <p className="text-base text-red-600 mt-2">
          ⚠️ Esta acción no se puede deshacer.
        </p>
      </Modal>
    </DashboardLayout>
  );
}