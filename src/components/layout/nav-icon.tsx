import { Bell, History, Home, Layers, Map, Shield, Store, Users, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  store: Store,
  map: Map,
  bell: Bell,
  users: Users,
  layers: Layers,
  shield: Shield,
  history: History,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Home;
  return <Icon className={className} />;
}
