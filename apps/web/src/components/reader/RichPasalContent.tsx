"use client";

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
          return <span key={i}>{token.value}</span>;
        }

        if (token.type === "pasal") {
          return (
            <a
              key={i}
              href={token.href}
              className="text-primary underline-offset-2 hover:underline"
            >
              {token.value}
            </a>
          );
        }

        if (token.type === "uu") {
          return (
            <Link
              key={i}
              href={token.href as Parameters<typeof Link>[0]["href"]}
              className="text-primary underline-offset-2 hover:underline"
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
