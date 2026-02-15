import { Link } from "@/i18n/routing";
import type { ReactNode } from "react";

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Parse markdown-style `[text](url)` into React nodes with Next.js `<Link>`.
 * Non-link text is returned as plain strings.
 */
export function parseInlineLinks(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  LINK_RE.lastIndex = 0;

  while ((match = LINK_RE.exec(text)) !== null) {
    // Push text before the match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [, linkText, url] = match;
    nodes.push(
      <Link
        key={`${url}-${match.index}`}
        href={url}
        className="text-primary font-medium hover:text-primary/80 underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {linkText}
      </Link>,
    );

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Strip `[text](url)` syntax, keeping only the display text.
 * Used for plain-text word counting during typing animation.
 */
export function stripLinkSyntax(text: string): string {
  return text.replace(LINK_RE, "$1");
}
