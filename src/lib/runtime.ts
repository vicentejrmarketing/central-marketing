/**
 * Adaptador de ambiente — versão Node.js (desenvolvimento local, testes e qualquer servidor Node).
 * No Cloudflare Workers, o build troca este arquivo por `runtime.workers.ts` (alias no vite.config.ts).
 * As duas versões exportam exatamente a mesma interface.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

export const RUNTIME = "node" as const;

/** No Node, um único cliente do banco com pool é reutilizado entre requisições. */
export const DB_CLIENT_PER_REQUEST = false;

export function databaseUrl(): string {
  // DATABASE_URL (Neon/local) ou as variáveis criadas pela integração Supabase da Vercel.
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL não definida");
  return url;
}

/*
 * Armazenamento privado de arquivos (fotos):
 * - Vercel: Blob PRIVADO (quando BLOB_READ_WRITE_TOKEN existe);
 * - desenvolvimento: pasta local ./.uploads.
 */
const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const LOCAL_DIR = path.join(process.cwd(), ".uploads");

function localPath(key: string) {
  const file = path.join(LOCAL_DIR, key);
  if (!file.startsWith(LOCAL_DIR + path.sep)) throw new Error("chave de arquivo inválida");
  return file;
}

export async function objectPut(key: string, data: ArrayBuffer, contentType: string): Promise<void> {
  if (blobEnabled()) {
    await put(key, new Blob([data], { type: contentType }), { access: "private", contentType, addRandomSuffix: false });
    return;
  }
  const file = localPath(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(data));
  await fs.writeFile(`${file}.meta`, contentType);
}

export async function objectGet(key: string): Promise<{ body: ReadableStream | Uint8Array; contentType: string } | null> {
  if (blobEnabled()) {
    const res = await get(key, { access: "private" });
    if (!res?.stream) return null;
    return { body: res.stream, contentType: res.blob.contentType ?? "application/octet-stream" };
  }
  try {
    const file = localPath(key);
    const [body, contentType] = await Promise.all([fs.readFile(file), fs.readFile(`${file}.meta`, "utf8").catch(() => "application/octet-stream")]);
    return { body: new Uint8Array(body), contentType };
  } catch {
    return null;
  }
}

export async function objectDelete(key: string): Promise<void> {
  if (blobEnabled()) {
    await del(key);
    return;
  }
  const file = localPath(key);
  await fs.rm(file, { force: true });
  await fs.rm(`${file}.meta`, { force: true });
}
