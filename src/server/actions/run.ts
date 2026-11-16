import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { fieldErrorsOf } from "@/lib/schemas";
import type { ActionResult } from "@/lib/types";
import { AppError, isAppError } from "@/server/errors";

/**
 * Runs the body of a server action and turns failures into a result the UI
 * can show. Framework control flow (redirects, not-found) passes through, and
 * unexpected errors are logged but never leak their details to the browser.
 */
export async function run<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    unstable_rethrow(error);
    if (isAppError(error)) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    console.error("Server action failed", error);
    return { ok: false, error: "Something went wrong on our side. Please try again." };
  }
}

/** Validates untrusted input, throwing a field-level AppError when it is wrong. */
export function parse<Schema extends z.ZodType>(schema: Schema, values: unknown): z.infer<Schema> {
  const result = schema.safeParse(values);
  if (!result.success) {
    throw new AppError("validation", "Please check the highlighted fields.", fieldErrorsOf(result.error));
  }
  return result.data;
}
