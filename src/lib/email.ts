import "server-only";
import { Resend } from "resend";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Envia e-mail transacional. Sem RESEND_API_KEY configurada, não envia e devolve sent=false,
 * e a tela mostra o link para o administrador copiar e enviar por outro meio.
 */
export async function sendEmail(input: { to: string; subject: string; html: string; text: string }) {
  if (!emailConfigured()) return { sent: false as const, reason: "not_configured" as const };
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) {
      console.error("[email] falha no envio", error);
      return { sent: false as const, reason: "provider_error" as const };
    }
    return { sent: true as const };
  } catch (err) {
    console.error("[email] falha no envio", err);
    return { sent: false as const, reason: "provider_error" as const };
  }
}

export function appUrl(path: string) {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function actionEmail(opts: { greeting: string; paragraphs: string[]; buttonLabel: string; url: string; footer: string }) {
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
<p>${escapeHtml(opts.greeting)}</p>
${opts.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
<p><a href="${opts.url}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${escapeHtml(opts.buttonLabel)}</a></p>
<p style="color:#64748b;font-size:13px">${escapeHtml(opts.footer)}</p>
</body></html>`;
  const text = `${opts.greeting}\n\n${opts.paragraphs.join("\n\n")}\n\n${opts.buttonLabel}: ${opts.url}\n\n${opts.footer}`;
  return { html, text };
}
