import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sesión de Llamada - Recuérdame",
  description: "Acceso directo para realizar llamadas con el agente de IA",
};

/**
 * Layout minimalista para usuarios finales (personas mayores)
 * Sin header, sidebar ni elementos complejos
 */
export default function UsuarioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}