/**
 * Adaptador de ambiente — versão Cloudflare Workers.
 * - Banco: conexão pelo Hyperdrive (pool gerenciado pelo Cloudflare); um cliente por requisição.
 * - Arquivos: bucket R2 privado (binding FILES).
 * Mesma interface de `runtime.ts`.
 */
import { env } from "cloudflare:workers";

type WorkerEnv = {
  HYPERDRIVE: { connectionString: string };
  FILES: {
    put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
    get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
    delete(key: string): Promise<void>;
  };
};

const bindings = env as unknown as WorkerEnv;

export const RUNTIME = "workers" as const;

/**
 * No Workers, conexões de rede não podem ser reaproveitadas entre requisições.
 * O Hyperdrive mantém o pool de verdade, então criar um cliente por requisição é barato.
 */
export const DB_CLIENT_PER_REQUEST = true;

export function databaseUrl(): string {
  return bindings.HYPERDRIVE.connectionString;
}

export async function objectPut(key: string, data: ArrayBuffer, contentType: string): Promise<void> {
  await bindings.FILES.put(key, data, { httpMetadata: { contentType } });
}

export async function objectGet(key: string): Promise<{ body: ReadableStream | Uint8Array; contentType: string } | null> {
  const obj = await bindings.FILES.get(key);
  if (!obj) return null;
  return { body: obj.body, contentType: obj.httpMetadata?.contentType ?? "application/octet-stream" };
}

export async function objectDelete(key: string): Promise<void> {
  await bindings.FILES.delete(key);
}
