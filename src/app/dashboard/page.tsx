'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';


function generarTokenUnico() {
  return Array.from(crypto.getRandomValues(new Uint8Array(22)))
    .map(x => ('0' + x.toString(16)).slice(-2))
    .join('');
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showQrIndex, setShowQrIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchProfileAndUsers = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.replace('/login');
        return;
      }
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

      if (profileData.center_id) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('*')
          .eq('center_id', profileData.center_id);
        if (usersError) setError(usersError.message);
        else setUsers(usersData);
      } else {
        setUsers([]);
      }
      setLoading(false);
    };
    fetchProfileAndUsers();
  }, [router]);

  const crearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !profile?.center_id) return;
    setCreating(true);
    const token = generarTokenUnico();
    const { error: userError } = await supabase
      .from('users')
      .insert([
        {
          center_id: profile.center_id,
          full_name: nameInput,
          login_token: token,
        },
      ]);
    if (!userError) {
      setNameInput('');
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('center_id', profile.center_id);
      setUsers(data || []);
    }
    setCreating(false);
  };

  if (loading) return <div>Cargando...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 20 }}>
      <h1>Panel de Gestión ({profile.role === 'admin' ? 'Administrador' : 'Manager'})</h1>
      <p>
        Centro: {profile.center_id
          ? profile.center_id
          : <span style={{ color: '#C00' }}>Sin centro asignado (contacta a admin)</span>
        }
      </p>

      {!profile.center_id && (
        <div style={{ color: '#C00', margin: '30px 0', fontWeight: 'bold' }}>
          No puedes gestionar usuarios hasta tener un centro asignado.
        </div>
      )}

      {profile.center_id && (
        <>
          <h2 style={{ marginTop: 30 }}>Usuarios del centro</h2>
          <form onSubmit={crearUsuario} style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Nombre completo del usuario"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              style={{ padding: 8, flex: 1 }}
              required
            />
            <button type="submit" disabled={creating || !nameInput.trim()}>
              {creating ? 'Creando...' : 'Crear usuario'}
            </button>
          </form>
        </>
      )}

      {profile.center_id && users.length === 0 && (
        <p>No hay usuarios aún.</p>
      )}
      {profile.center_id && users.length > 0 && (
        <table style={{ width: '100%', marginTop: 20, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Nombre completo</th>
              <th>Token/Enlace</th>
              <th>QR</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, idx) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td>
                  <code>/u/{u.login_token}</code>
                  <button
                    style={{
                      marginLeft: 8, padding: '2px 6px', fontSize: 12,
                      cursor: 'pointer'
                    }}
                    onClick={() => setShowQrIndex(idx === showQrIndex ? null : idx)}
                  >
                    QR
                  </button>
                </td>
                <td>
                  {showQrIndex === idx && (
                    <div style={{ padding: 4 }}>
                      <QRCode
                        value={`https://tusitioweb.com/u/${u.login_token}`}
                        size={80}
                        includeMargin={true}
                      />
                    </div>
                  )}
                </td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
