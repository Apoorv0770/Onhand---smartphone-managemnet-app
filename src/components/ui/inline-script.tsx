"use client";

/**
 * A script that runs while the HTML is parsed, before the first paint.
 * On the server it is a real script. On the client React would never execute
 * it anyway, so it is rendered as inert text, which also avoids React's
 * "script tag while rendering" warning during client-side navigation.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
