import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema Web de Asistencia con Validacion GPS",
  description: "Control de asistencia con activacion por codigo y validacion GPS."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#f5f6f8] text-[#132338] antialiased">
        {children}
      </body>
    </html>
  );
}
