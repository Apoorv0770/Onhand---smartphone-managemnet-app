import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { Business, User } from "@/lib/types";
import { getBackend } from "@/server/backend";

export interface SessionContext {
  user: User | null;
  business: Business | null;
}

/**
 * Who is making this request, and which business they manage.
 * Memoised per render so layouts and pages share one lookup.
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  // Sessions only exist at request time. Never resolve one while prerendering.
  await connection();
  const backend = await getBackend();
  const user = await backend.auth.getUser();
  if (!user) return { user: null, business: null };
  const business = await backend.getBusinessForUser(user.id);
  return { user, business };
});

/** For pages that need a signed-in user. Redirects to sign-in otherwise. */
export async function requireUser(): Promise<User> {
  const { user } = await getSessionContext();
  if (!user) redirect("/login");
  return user;
}

/**
 * For dashboard pages and actions. The business always comes from the session,
 * never from anything the client sends, so one retailer cannot name another's.
 */
export async function requireBusiness(): Promise<{ user: User; business: Business }> {
  const { user, business } = await getSessionContext();
  if (!user) redirect("/login");
  if (!business) redirect("/onboarding");
  return { user, business };
}
