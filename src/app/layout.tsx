import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PLADET - Sistema de Seguimiento de Proyectos | USACH",
  description: "Dirección de Planificación y Desarrollo Territorial - Sistema Kanban de gestión de proyectos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
