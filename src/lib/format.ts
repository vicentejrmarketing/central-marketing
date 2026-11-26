/** Formatação no padrão brasileiro, sempre no fuso America/Sao_Paulo. */
const TZ = "America/Sao_Paulo";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const moneyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const relFmt = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export const formatDate = (d: Date | string | null | undefined) => (d ? dateFmt.format(new Date(d)) : "—");
export const formatDateTime = (d: Date | string | null | undefined) => (d ? dateTimeFmt.format(new Date(d)).replace(",", " às") : "—");
/** Valores monetários são guardados em centavos (inteiro). */
export const formatMoney = (cents: number | null | undefined) => (cents == null ? "—" : moneyFmt.format(cents / 100));

export function formatRelative(d: Date | string, now = new Date()) {
  const diff = (new Date(d).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "agora";
  if (abs < 3600) return relFmt.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return relFmt.format(Math.round(diff / 3600), "hour");
  if (abs < 7 * 86400) return relFmt.format(Math.round(diff / 86400), "day");
  return formatDate(d);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

export function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
}
