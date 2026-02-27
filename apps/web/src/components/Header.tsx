import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import SearchBar from "./SearchBar";
import PasalLogo from "./PasalLogo";
import MobileNav from "./MobileNav";
import ShimmerLink from "./ShimmerLink";
import LanguageSwitcher from "./LanguageSwitcher";

interface HeaderProps {
  showSearch?: boolean;
  searchDefault?: string;
  searchPreserveParams?: Record<string, string>;
}

const navLinkClass = "text-muted-foreground hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export default function Header({ showSearch = false, searchDefault, searchPreserveParams }: HeaderProps) {
  const t = useTranslations("navigation");

  const NAV_LINKS = [
    { href: "/search" as const, label: t("search") },
    { href: "/jelajahi" as const, label: t("browse") },
    { href: "/topik" as const, label: t("topics") },
    { href: "/api" as const, label: t("api") },
  ];

  return (
    <header className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 lg:gap-8 py-4 px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2 text-2xl font-heading shrink-0">
          <PasalLogo size={32} />
          <span>Pasal<span className="text-muted-foreground">.id</span></span>
        </Link>
        {showSearch && (
          <div className="min-w-0 flex-1">
            <SearchBar defaultValue={searchDefault} preserveParams={searchPreserveParams} />
          </div>
        )}
        <nav className="hidden lg:flex items-center gap-6 text-base shrink-0">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className={navLinkClass}>
              {label}
            </Link>
          ))}
          <LanguageSwitcher />
          <ShimmerLink
            href="/connect"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-sans font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("connect")}
          </ShimmerLink>
        </nav>
        <MobileNav />
      </div>
    </header>
  );
}
