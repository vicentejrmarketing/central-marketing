// Tipagem mínima do módulo nativo do Workers para o type-check fora do build do Cloudflare.
// O build do vinext usa os tipos completos gerados em .cloudflare/types.
declare module "cloudflare:workers" {
  export const env: unknown;
}
