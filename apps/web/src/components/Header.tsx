import Link from "next/link";
import SearchBar from "./SearchBar";

interface HeaderProps {
  showSearch?: boolean;
  searchDefault?: string;
}

export default function Header({ showSearch = false, searchDefault }: HeaderProps) {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex items-center gap-4 py-3 px-4">
        <Link href="/" className="text-xl font-bold shrink-0">
          Pasal<span className="text-primary/60">.id</span>
        </Link>
        {showSearch && <SearchBar defaultValue={searchDefault} />}
        <nav className="flex items-center gap-3 text-sm shrink-0">
          <Link href="/search" className="text-muted-foreground hover:text-foreground transition-colors">
            Cari
          </Link>
          <Link href="/topik" className="text-muted-foreground hover:text-foreground transition-colors">
            Topik
          </Link>
          <Link href="/bookmark" className="text-muted-foreground hover:text-foreground transition-colors">
            Simpan
          </Link>
          <Link href="/connect" className="text-muted-foreground hover:text-foreground transition-colors">
            Hubungkan
          </Link>
        </nav>
      </div>
    </header>
  );
}
