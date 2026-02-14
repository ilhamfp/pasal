import Link from "next/link";
import SearchBar from "./SearchBar";
import PasalLogo from "./PasalLogo";

interface HeaderProps {
  showSearch?: boolean;
  searchDefault?: string;
}

const NAV_LINKS = [
  { href: "/jelajahi", label: "Jelajahi" },
  { href: "/api", label: "API" },
] as const;

const navLinkClass = "text-muted-foreground hover:text-foreground transition-colors";

export default function Header({ showSearch = false, searchDefault }: HeaderProps) {
  return (
    <header className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-8 py-4 px-6">
        <Link href="/" className="flex items-center gap-2 text-2xl font-heading shrink-0">
          <PasalLogo size={32} />
          <span>Pasal<span className="text-muted-foreground">.id</span></span>
        </Link>
        {showSearch && <SearchBar defaultValue={searchDefault} />}
        <nav className="flex items-center gap-6 text-base shrink-0">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className={navLinkClass}>
              {label}
            </Link>
          ))}
          <Link
            href="/connect"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-sans font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Connect Claude
          </Link>
        </nav>
      </div>
    </header>
  );
}
