"use client";
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/avatar";
import { logoutAction } from "@/modules/auth/actions";

export function UserMenu({
  name,
  email,
  roleName,
  avatarSrc,
}: {
  name: string;
  email: string;
  roleName: string;
  avatarSrc: string | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex shrink-0 items-center gap-2 rounded-md p-1 hover:bg-accent" aria-label="Menu do usuário">
        <UserAvatar name={name} src={avatarSrc} />
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-sm font-medium">{name}</span>
          <span className="block text-xs text-muted-foreground">{roleName}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block text-sm font-medium text-foreground">{name}</span>
          <span className="block font-normal">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/perfil">
            <UserRound /> Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut /> Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
