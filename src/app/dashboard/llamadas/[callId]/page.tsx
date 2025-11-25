'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/ToastContext';

interface Transcript {
  id: string;
  call_id: string;
  content: string;
  metadata: any;
  created_at: string;
}

interface Call {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  status: string;
  users: {
    full_name: string;
  };
}

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'manager';
  center_id?: string | null;
}

export default function TranscriptPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const callId = params.callId as string;

  const [call, setCall] = useState<Call | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetchTranscript();
  }, [callId]);

  const fetchTranscript = async () => {
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

      // Obtener call con info del usuario
      const { data: callData, error: callError } = await supabase
        .from('calls')
        .select(`
          *,
          users (
            full_name
          )
        `)
        .eq('id', callId)
        .single();

      if (callError) {
        showToast('Llamada no encontrada', 'error');
        router.replace('/dashboard/usuarios');
        return;
      }

      setCall(callData);

      // Obtener transcripción (puede no existir aún)
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('transcripts')
        .select('*')
        .eq('call_id', callId)
        .single();

      if (transcriptError && transcriptError.code !== 'PGRST116') {
        console.error('Error obteniendo transcripción:', transcriptError);
      }

      setTranscript(transcriptData);
    } catch (err: any) {
      console.error('Error:', err);
      showToast(err.message || 'Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadTranscript = () => {
    if (!transcript || !call) return;

    const userName = (call.users as any).full_name;
    const date = new Date(call.started_at).toLocaleString('es-ES');
    const duration = formatDuration(call.duration_seconds);

    const content = `
╔════════════════════════════════════════════════════════════════╗
║           TRANSCRIPCIÓN DE LLAMADA - RECUÉRDAME               ║
╚════════════════════════════════════════════════════════════════╝

Usuario:    ${userName}
Fecha:      ${date}
Duración:   ${duration}
Estado:     ${call.status === 'completed' ? 'Completada' : call.status}

────────────────────────────────────────────────────────────────

TRANSCRIPCIÓN:

${transcript.content}

────────────────────────────────────────────────────────────────

Generado el ${new Date().toLocaleString('es-ES')}
ID de llamada: ${callId}

════════════════════════════════════════════════════════════════
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcripcion-${userName.replace(/\s+/g, '-')}-${new Date(call.started_at).toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    
    showToast('Transcripción descargada', 'success');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusInfo = (status: string) => {
    const statusMap = {
      completed: {
        color: 'bg-green-100 text-green-800 border-green-300',
        label: 'Completada',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      started: {
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        label: 'En curso',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      failed: {
        color: 'bg-red-100 text-red-800 border-red-300',
        label: 'Fallida',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.failed;
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

  if (!call) {
    return (
      <DashboardLayout profile={profile ? { 
        email: profile.email, 
        role: profile.role, 
        center_id: profile.center_id || undefined 
      } : undefined}>
        <div className="text-center py-12">
          <p className="text-xl text-red-600">Llamada no encontrada</p>
        </div>
      </DashboardLayout>
    );
  }

  const statusInfo = getStatusInfo(call.status);

  return (
    <DashboardLayout profile={profile ? { 
      email: profile.email, 
      role: profile.role, 
      center_id: profile.center_id || undefined 
    } : undefined}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <Button variant="secondary" size="md" onClick={() => router.back()} className="mb-4">
            ← Volver
          </Button>
          <h1 className="text-4xl font-bold text-gray-900">Transcripción de Llamada</h1>
          <p className="text-xl text-gray-600 mt-2">
            Conversación con {(call.users as any).full_name}
          </p>
        </div>

        {/* Info de la llamada */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-sm text-gray-600 font-medium">Usuario</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{(call.users as any).full_name}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-600 font-medium">Fecha y Hora</p>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {new Date(call.started_at).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
              <p className="text-sm text-gray-600">
                {new Date(call.started_at).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-600 font-medium">Duración</p>
              </div>
              <p className="text-lg font-bold text-gray-900 font-mono">
                {formatDuration(call.duration_seconds)}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-600 font-medium">Estado</p>
              </div>
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold border-2 ${statusInfo.color}`}>
                {statusInfo.icon}
                {statusInfo.label}
              </span>
            </div>
          </div>
        </div>

        {/* Transcripción */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b-2 border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Transcripción</h2>
              {transcript && (
                <p className="text-sm text-gray-600 mt-1">
                  Generada el {new Date(transcript.created_at).toLocaleDateString('es-ES')} a las{' '}
                  {new Date(transcript.created_at).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
            </div>
            {transcript && (
              <Button variant="secondary" size="md" onClick={downloadTranscript}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar TXT
              </Button>
            )}
          </div>

          <div className="p-8">
            {!transcript ? (
              <div className="text-center py-12">
                <svg className="w-20 h-20 mx-auto text-gray-400 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">No hay transcripción disponible</h3>
                <p className="text-lg text-gray-600 mb-6">
                  La transcripción se genera automáticamente al finalizar la llamada
                </p>
                <div className="inline-flex items-center gap-3 bg-blue-50 px-6 py-4 rounded-lg border-2 border-blue-200">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-blue-900">
                      {call.status === 'completed' ? 'Procesando...' : 'En espera...'}
                    </p>
                    <p className="text-sm text-blue-700">
                      {call.status === 'completed' 
                        ? 'La transcripción debería aparecer en unos momentos' 
                        : 'La llamada debe completarse primero'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Transcripción principal */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8 border-2 border-gray-200">
                  <pre className="whitespace-pre-wrap text-base text-gray-800 font-sans leading-relaxed">
                    {transcript.content}
                  </pre>
                </div>

                {/* Metadata técnica (colapsable) */}
                {transcript.metadata && Object.keys(transcript.metadata).length > 0 && (
                  <details className="group">
                    <summary className="flex items-center gap-2 text-base font-semibold text-gray-700 cursor-pointer hover:text-gray-900 select-none">
                      <svg className="w-5 h-5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Información técnica
                    </summary>
                    <div className="mt-4 p-6 bg-gray-900 rounded-lg overflow-x-auto">
                      <pre className="text-xs text-green-400 font-mono">
                        {JSON.stringify(transcript.metadata, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}

                {/* Info adicional */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Sobre esta transcripción</p>
                    <p className="text-blue-800">
                      Esta transcripción fue generada automáticamente por el sistema de conversación de IA. 
                      El contenido refleja la conversación mantenida entre el usuario y el asistente virtual.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}