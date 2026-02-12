"use client";

interface TocNode {
  id: number;
  number: string;
  heading: string | null;
  node_type: string;
  parent_id: number | null;
}

export default function TableOfContents({
  babs,
  pasals,
}: {
  babs: TocNode[];
  pasals: TocNode[];
}) {
  return (
    <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <h2 className="text-sm font-semibold mb-3">Daftar Isi</h2>
      <ul className="space-y-1 text-sm">
        {babs.map((bab) => {
          const babPasals = pasals.filter((p) => p.parent_id === bab.id);

          return (
            <li key={bab.id}>
              <a
                href={`#bab-${bab.number}`}
                className="block py-1 text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                BAB {bab.number}
                {bab.heading && (
                  <span className="block text-xs font-normal truncate">
                    {bab.heading}
                  </span>
                )}
              </a>
              {babPasals.length > 0 && (
                <ul className="ml-3 space-y-0.5">
                  {babPasals.slice(0, 10).map((pasal) => (
                    <li key={pasal.id}>
                      <a
                        href={`#pasal-${pasal.number}`}
                        className="block py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Pasal {pasal.number}
                      </a>
                    </li>
                  ))}
                  {babPasals.length > 10 && (
                    <li className="text-xs text-muted-foreground py-0.5">
                      +{babPasals.length - 10} pasal lainnya
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
