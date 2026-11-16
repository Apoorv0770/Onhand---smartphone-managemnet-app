import "server-only";
import { connection } from "next/server";

/**
 * The current time for this request, in milliseconds.
 * Waiting for the connection first guarantees it is read while serving a real
 * request and never frozen into a prerendered shell.
 */
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}
