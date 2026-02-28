"use client";

import { Fragment } from "react";
import { Link } from "@/i18n/routing";
import { tokenize } from "@/lib/crossref";

interface RichPasalContentProps {
  content: string;
  worksLookup: Record<string, string>;
}

/**
 * Renders pasal body text with inline hyperlinks for cross-references.
 *
 * - "Pasal N" / "Pasal N ayat (X)" → anchor link to #pasal-N (same page)
 * - "Undang-Undang Nomor N Tahun YYYY" → Link to /peraturan/[type]/[slug]
 *   (only if the work exists in worksLookup; otherwise renders as plain text)
 *
 * Preserves whitespace-pre-wrap formatting. Pure render — no side effects.
 */
export default function RichPasalContent({
  content,
  worksLookup,
}: RichPasalContentProps) {
  const tokens = tokenize(content, worksLookup);

  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap">
      {tokens.map((token, i) => {
        if (token.type === "text") {
          return <Fragment key={i}>{token.value}</Fragment>;
        }

        if (token.type === "pasal") {
          return (
            <a
              key={i}
              href={token.href}
              className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {token.value}
            </a>
          );
        }

        if (token.type === "uu") {
          return (
            <Link
              key={i}
              // token.href is a string path from DB lookup (e.g. "/peraturan/uu/uu-13-2003").
              // next-intl's Link expects a typed route — cast is safe at runtime.
              href={token.href as Parameters<typeof Link>[0]["href"]}
              className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {token.value}
            </Link>
          );
        }

        return null;
      })}
    </div>
  );
}
