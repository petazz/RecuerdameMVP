'use client';

import React, { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface DashboardLayoutProps {
  children: React.ReactNode;
  profile?: {
    email: string;
    role: 'admin' | 'manager';
    center_id?: string;
  };
}

export function DashboardLayout({ children, profile }: DashboardLayoutProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
     {/* Header */}
      <header className="bg-white border-b-2 border-[#E8DCC8] sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-[#F5F1E8] focus:outline-none focus:ring-4 focus:ring-[#A8B9A0] lg:hidden"
              aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              <svg className="w-6 h-6 text-[#2C2C2C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#8B9D83] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">R</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#2C2C2C]">Recuérdame</h1>
                <p className="text-xs text-gray-600">Panel de Gestión</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {profile && (
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-[#F5F1E8] rounded-lg">
                <div className="w-10 h-10 bg-[#8B9D83] rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {profile.email[0].toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-[#2C2C2C]">{profile.email}</p>
                  <p className="text-xs text-gray-600">
                    {profile.role === 'admin' ? 'Administrador' : 'Manager'}
                  </p>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-red-300 disabled:opacity-50 min-h-[48px]"
            >
              {loggingOut ? 'Saliendo...' : 'Cerrar Sesión'}
            </button>
          </div>
        </div>
      </header>
      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed lg:static lg:translate-x-0 inset-y-0 left-0 z-30 w-72 bg-white border-r-2 border-gray-200 transition-transform duration-300 ease-in-out`}
        >
          <nav className="p-6 space-y-3 mt-4">
            <NavItem
              href="/dashboard"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              }
              label="Inicio"
            />
            <NavItem
              href="/dashboard/usuarios"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
              label="Usuarios"
            />
            {profile?.role === 'admin' && (
              <NavItem
                href="/dashboard/centros"
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
                label="Centros"
              />
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-4 px-4 py-3 text-lg font-medium text-[#2C2C2C] hover:bg-[#E8DCC8] hover:text-[#6B7D63] rounded-lg transition-colors focus:outline-none focus:ring-4 focus:ring-[#A8B9A0]"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}