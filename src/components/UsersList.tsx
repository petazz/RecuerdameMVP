'use client';

import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useToast } from '@/components/ToastContext';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface User {
  id: string;
  full_name: string;
  email?: string;
  login_token: string;
  created_at: string;
}

interface UsersListProps {
  users: User[];
  loading: boolean;
  onDelete: (userId: string) => Promise<void>;
}

export function UsersList({ users, loading, onDelete }: UsersListProps) {
  const { showToast } = useToast();
  const [selectedQR, setSelectedQR] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const getLoginUrl = (token: string) => {
    return `${window.location.origin}/u/${token}`;
  };

  const handleCopyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(getLoginUrl(token));
      showToast('Enlace copiado al portapapeles', 'success');
    } catch (error) {
      showToast('Error al copiar el enlace', 'error');
    }
  };

  const handleDownloadQR = (user: User) => {
    const canvas = document.getElementById(`qr-${user.id}`) as HTMLCanvasElement;
    if (!canvas) return;

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `qr-${user.full_name.replace(/\s+/g, '-')}.png`;
    link.href = url;
    link.click();
    showToast('Código QR descargado', 'success');
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    setDeleting(true);
    try {
      await onDelete(deleteConfirm.id);
      showToast('Usuario eliminado correctamente', 'success');
      setDeleteConfirm(null);
    } catch (error) {
      showToast('Error al eliminar el usuario', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <svg
          className="w-24 h-24 mx-auto text-gray-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">No hay usuarios aún</h3>
        <p className="text-lg text-gray-600">Crea tu primer usuario para comenzar</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Nombre</th>
                <th className="px-6 py-4 text-left text-lg font-bold text-gray-900">Email</th>
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
                    <p className="text-base text-gray-600">{user.email || '—'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-base text-gray-600">
                      {new Date(user.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopyLink(user.login_token)}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copiar Enlace
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedQR(user)}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        Ver QR
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteConfirm(user)}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal QR */}
      <Modal
        isOpen={!!selectedQR}
        onClose={() => setSelectedQR(null)}
        title={`Código QR - ${selectedQR?.full_name}`}
        footer={
          <>
            <Button variant="primary" size="md" onClick={() => selectedQR && handleDownloadQR(selectedQR)}>
              Descargar QR
            </Button>
            <Button variant="secondary" size="md" onClick={() => setSelectedQR(null)}>
              Cerrar
            </Button>
          </>
        }
      >
        {selectedQR && (
          <div className="flex flex-col items-center gap-6">
            <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
              <QRCodeCanvas
                id={`qr-${selectedQR.id}`}
                value={getLoginUrl(selectedQR.login_token)}
                size={320}
                level="H"
                includeMargin={true}
              />
            </div>
            <div className="text-center">
              <p className="text-lg text-gray-700 mb-2">Enlace de acceso:</p>
              <code className="block px-4 py-3 bg-gray-100 rounded-lg text-sm break-all">
                {getLoginUrl(selectedQR.login_token)}
              </code>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Confirmación Eliminar */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmar Eliminación"
        footer={
          <>
            <Button variant="danger" size="md" onClick={handleDelete} loading={deleting}>
              Sí, Eliminar
            </Button>
            <Button variant="secondary" size="md" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
              Cancelar
            </Button>
          </>
        }
      >
        <p className="text-lg text-gray-700">
          ¿Estás seguro de que deseas eliminar al usuario <strong>{deleteConfirm?.full_name}</strong>?
        </p>
        <p className="text-base text-red-600 mt-4 font-medium">
          Esta acción no se puede deshacer.
        </p>
      </Modal>
    </>
  );
}