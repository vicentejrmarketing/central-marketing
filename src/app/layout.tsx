import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Central de Gestão do Marketing", template: "%s · Central de Marketing" },
  description: "Gestão operacional do departamento de Marketing.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1e2a4a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full">
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
