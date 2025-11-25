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
  calls_today?: number;
  last_call?: string;
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
  const [generatedUrl, setGeneratedUrl] = useState('');
  
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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('center_id', centerId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      setUsers(data || []);
      setHasMore((data || []).length === PAGE_SIZE);
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

      const url = `${window.location.origin}/u/${token}`;
      setGeneratedUrl(url);
      setSelectedUser(data);
      
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

  const getUserUrl = (token: string) => `${window.location.origin}/u/${token}`;

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
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Creado</th>
                    <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-lg font-semibold text-gray-900">{user.full_name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-base text-gray-600">
                          {new Date(user.created_at).toLocaleDateString('es-ES', {
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
                            onClick={() => copyToClipboard(getUserUrl(user.login_token))}
                          >
                            Copiar enlace
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/dashboard/usuarios/${user.id}`)}
                          >
                            Ver
                          </Button>
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
        title={`Usuario Creado: ${selectedUser?.full_name}`}
        footer={
          <>
            <Button variant="primary" size="md" onClick={downloadQR}>
              Descargar QR
            </Button>
            <Button variant="secondary" size="md" onClick={() => copyToClipboard(generatedUrl)}>
              Copiar Enlace
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowQRModal(false)}>
              Cerrar
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-6">
          <QRCodeCanvas
            id="qr-canvas"
            value={generatedUrl}
            size={320}
            level="H"
            includeMargin={true}
          />
          <div className="text-center w-full">
            <p className="text-lg text-gray-700 mb-2">Enlace de acceso:</p>
            <code className="block px-4 py-3 bg-gray-100 rounded-lg text-sm break-all">
              {generatedUrl}
            </code>
          </div>
        </div>
      </Modal>

      {/* Modal: Editar Usuario */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Usuario"
        footer={
          <>
            <Button variant="primary" size="md" onClick={handleEditUser}>
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
            label="Nombre Completo *"
            type="text"
            value={editUserName}
            onChange={(e) => setEditUserName(e.target.value)}
            required
          />
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Nota:</strong> El token de acceso no se puede modificar por seguridad.
            </p>
          </div>
        </div>
      </Modal>

      {/* Modal: Eliminar Usuario */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirmar Eliminación"
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
        <div className="space-y-4">
          <p className="text-lg text-gray-700">
            ¿Estás seguro de que deseas eliminar al usuario <strong>{selectedUser?.full_name}</strong>?
          </p>
          <p className="text-base text-red-600 font-medium">
            ⚠️ Esta acción no se puede deshacer. Se eliminarán todos los datos asociados.
          </p>
        </div>
      </Modal>
    </DashboardLayout>
  );
}