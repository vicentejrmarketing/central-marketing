/** URL da foto de perfil (rota protegida). A chave entra na URL para invalidar o cache quando a foto muda. */
export function avatarUrl(userId: string, avatarKey: string | null | undefined) {
  return avatarKey ? `/api/files/avatar/${userId}?v=${encodeURIComponent(avatarKey.slice(-12))}` : null;
}
