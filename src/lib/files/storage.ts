import "server-only";
import { objectDelete, objectGet, objectPut } from "@/lib/runtime";

/**
 * Armazenamento privado de fotos (perfil, equipamentos, empréstimos).
 * Cloudflare: bucket R2 privado. Node/desenvolvimento: pasta local ./.uploads.
 * As fotos só são servidas por rotas que checam a sessão.
 */
export const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function putPrivateFile(key: string, data: Blob, contentType: string): Promise<string> {
  const finalKey = `${key.replace(/\.[^.]+$/, "")}-${crypto.randomUUID().slice(0, 8)}${key.match(/\.[^.]+$/)?.[0] ?? ""}`;
  await objectPut(finalKey, await data.arrayBuffer(), contentType);
  return finalKey;
}

export async function getPrivateFile(key: string) {
  return objectGet(key);
}

export async function deletePrivateFile(key: string) {
  try {
    await objectDelete(key);
  } catch {
    // arquivo já removido: nada a fazer
  }
}
