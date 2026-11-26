import "server-only";
import { cache } from "react";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { DB_CLIENT_PER_REQUEST, databaseUrl } from "@/lib/runtime";

function createClient() {
  const adapter = new PrismaPg({
    connectionString: databaseUrl(),
    // No Workers, o Hyperdrive faz o pool; aqui basta uma conexão por requisição.
    max: DB_CLIENT_PER_REQUEST ? 1 : Number(process.env.DB_POOL_MAX ?? 5),
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Node: um cliente para o processo inteiro. Workers: um cliente por requisição (React cache). */
const requestClient = cache(createClient);

function currentClient(): PrismaClient {
  if (DB_CLIENT_PER_REQUEST) return requestClient();
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/**
 * `db` continua sendo usado como antes em todos os serviços; por baixo,
 * cada acesso pega o cliente certo para o ambiente.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = currentClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Db = PrismaClient;
/** Cliente dentro de uma transação interativa. */
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
