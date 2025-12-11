'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/ToastContext';

interface Call {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: 'started' | 'completed' | 'failed';
  transcript: string | null;
  elevenlabs_conversation_id: string | null;
}

interface User {
  id: string;
  full_name: string;
  center_id: string;
}

interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'manager';
  center_id?: string | null;
}

export default function TranscriptionPage() {
  const router = useRouter();
  const params = useParams();
  const { showToast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCallData();
  }, []);

  const fetchCallData = async () => {
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

      const callId = params.callId as string;

      const { data: callData, error: callError } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (callError || !callData) {
        showToast('Llamada no encontrada', 'error');
        router.replace('/dashboard');
        return;
      }

      setCall(callData);

      const { data: userDetailData, error: userDetailError } = await supabase
        .from('users')
        .select('*')
        .eq('id', callData.user_id)
        .eq('center_id', profileData.center_id)
        .single();

      if (userDetailError || !userDetailData) {
        showToast('Usuario no encontrado o sin permisos', 'error');
        router.replace('/dashboard');
        return;
      }

      setUser(userDetailData);

    } catch (err: any) {
      showToast(err.message || 'Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '0s';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (mins > 0) {
      return `${mins} minuto${mins !== 1 ? 's' : ''} ${secs} segundo${secs !== 1 ? 's' : ''}`;
    }
    return `${secs} segundo${secs !== 1 ? 's' : ''}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusInfo = (status: string) => {
    const statusConfig = {
      completed: {
        label: 'Completada',
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        icon: (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      started: {
        label: 'En curso',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        icon: (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      failed: {
        label: 'Fallida',
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        icon: (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
    };

    return statusConfig[status as keyof typeof statusConfig] || statusConfig.failed;
  };

  const downloadTranscript = () => {
    if (!call || !call.transcript || !user) return;

    const content = `
TRANSCRIPCIÓN DE LLAMADA
========================

Usuario: ${user.full_name}
Fecha: ${formatDate(call.started_at)}
Duración: ${formatDuration(call.duration_seconds)}
Estado: ${getStatusInfo(call.status).label}

Transcripción:
--------------
${call.transcript}

ID de Llamada: ${call.id}
ID de Conversación ElevenLabs: ${call.elevenlabs_conversation_id || 'N/A'}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcripcion-${user.full_name}-${new Date(call.started_at).toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);

    showToast('Transcripción descargada', 'success');
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

  const statusInfo = call ? getStatusInfo(call.status) : null;

  return (
    <DashboardLayout profile={profile ? { 
      email: profile.email, 
      role: profile.role, 
      center_id: profile.center_id || undefined 
    } : undefined}>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 truncate">
              Transcripción de Llamada
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 mt-2">
              {user?.full_name || 'Usuario'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="primary"
              size="lg"
              onClick={downloadTranscript}
              disabled={!call?.transcript}
              className="w-full sm:w-auto"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Descargar</span>
              <span className="sm:hidden">Descargar Transcripción</span>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => router.back()}
              className="w-full sm:w-auto"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver
            </Button>
          </div>
        </div>

        {/* Información de la llamada */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-2 border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 font-medium">Fecha y Hora</p>
                <p className="text-sm sm:text-base font-bold text-gray-900 truncate">
                  {call ? new Date(call.started_at).toLocaleDateString('es-ES', { 
                    day: '2-digit', 
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-2 border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 font-medium">Duración</p>
                <p className="text-sm sm:text-base font-bold text-gray-900 truncate">
                  {call ? formatDuration(call.duration_seconds) : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-2 border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 sm:p-3 ${statusInfo?.bgColor} rounded-lg`}>
                <div className={statusInfo?.textColor}>
                  {statusInfo?.icon}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 font-medium">Estado</p>
                <p className={`text-sm sm:text-base font-bold ${statusInfo?.textColor} truncate`}>
                  {statusInfo?.label || 'Desconocido'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-2 border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 font-medium">Usuario</p>
                <p className="text-sm sm:text-base font-bold text-gray-900 truncate">
                  {user?.full_name || 'Desconocido'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Transcripción */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-blue-500 to-blue-600 border-b-2 border-blue-700">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Transcripción</h2>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {!call?.transcript ? (
              <div className="text-center py-8 sm:py-12">
                <svg className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                  No hay transcripción disponible
                </h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Esta llamada aún no tiene una transcripción o está siendo procesada
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 sm:p-6 lg:p-8 border-2 border-gray-200">
                <div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none">
                  <pre className="whitespace-pre-wrap text-sm sm:text-base lg:text-lg leading-relaxed text-gray-800 font-sans break-words">
                    {call.transcript}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Información técnica */}
        {call?.elevenlabs_conversation_id && (
          <div className="bg-gray-100 rounded-xl shadow-lg p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3">Información Técnica</h3>
            <div className="space-y-2 text-sm sm:text-base">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-gray-600 font-medium">ID de Llamada:</span>
                <code className="bg-white px-3 py-1 rounded border border-gray-300 font-mono text-xs sm:text-sm break-all">
                  {call.id}
                </code>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-gray-600 font-medium">ID de Conversación ElevenLabs:</span>
                <code className="bg-white px-3 py-1 rounded border border-gray-300 font-mono text-xs sm:text-sm break-all">
                  {call.elevenlabs_conversation_id}
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}