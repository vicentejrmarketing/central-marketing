import { db } from "@/lib/db";

export async function databaseIsUp(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    console.error("[health] banco indisponível", err);
    return false;
  }
}
