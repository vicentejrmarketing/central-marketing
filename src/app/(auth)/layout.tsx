import { Megaphone } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sidebar px-4 py-10">
      <div className="mb-6 flex items-center gap-3 text-white">
        <span className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary/20 text-sidebar-primary">
          <Megaphone className="size-5" />
        </span>
        <div className="leading-tight">
          <p className="text-lg font-semibold">Central de Gestão do Marketing</p>
          <p className="text-sm text-sidebar-muted">Acesso restrito à equipe</p>
        </div>
      </div>
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl sm:p-8">{children}</div>
    </div>
  );
}
