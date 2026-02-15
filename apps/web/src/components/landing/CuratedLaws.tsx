import { getTranslations } from "next-intl/server";
import { getRegTypeCode } from "@/lib/get-reg-type-code";
import { createClient } from "@/lib/supabase/server";
import LawCarousel, { type LawData } from "./LawCarousel";
import RevealOnScroll from "./RevealOnScroll";

const CURATED = [
  {
    frbr_uri: "/akn/id/act/uu/2003/13",
    tagline: "Landasan hak pekerja Indonesia",
  },
  {
    frbr_uri: "/akn/id/act/uu/1974/1",
    tagline: "Dasar hukum perkawinan di Indonesia",
  },
  {
    frbr_uri: "/akn/id/act/uu/2023/1",
    tagline: "Kitab hukum pidana baru, berlaku 2026",
  },
  {
    frbr_uri: "/akn/id/act/uu/2022/27",
    tagline: "Perlindungan data pribadi warga negara",
  },
  {
    frbr_uri: "/akn/id/act/uu/2023/6",
    tagline: "Omnibus law yang mengubah ratusan pasal",
  },
];

export default async function CuratedLaws() {
  const t = await getTranslations("curated");
  const supabase = await createClient();

  const { data: works } = await supabase
    .from("works")
    .select(
      "id, frbr_uri, title_id, number, year, status, regulation_types(code)"
    )
    .in(
      "frbr_uri",
      CURATED.map((c) => c.frbr_uri)
    );

  if (!works || works.length === 0) return null;

  // Maintain curated order
  const ordered = CURATED.map((c) => {
    const work = works.find((w) => w.frbr_uri === c.frbr_uri);
    return work ? { ...work, tagline: c.tagline } : null;
  }).filter(Boolean) as (typeof works[number] & { tagline: string })[];

  if (ordered.length === 0) return null;

  // Fetch first pasal for each law in parallel
  const pasalResults = await Promise.all(
    ordered.map((work) =>
      supabase
        .from("document_nodes")
        .select("number, content_text")
        .eq("work_id", work.id)
        .eq("node_type", "pasal")
        .eq("number", "1")
        .limit(1)
        .single()
    )
  );

  // Transform into serializable data for the client carousel
  const lawData: LawData[] = ordered.map((work, i) => {
    const regType = getRegTypeCode(work.regulation_types);
    const pasal = pasalResults[i]?.data;
    const snippet = pasal?.content_text
      ? pasal.content_text.length > 120
        ? pasal.content_text.slice(0, 120) + "..."
        : pasal.content_text
      : null;

    return {
      id: String(work.id),
      titleId: work.title_id,
      number: work.number,
      year: work.year,
      status: work.status,
      regType,
      slug: `${regType.toLowerCase()}-${work.number}-${work.year}`,
      tagline: work.tagline,
      snippet,
      pasalNumber: pasal?.number ?? null,
    };
  });

  return (
    <section className="border-b py-16 sm:py-20">
      <RevealOnScroll>
        <div className="mx-auto max-w-5xl px-4">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("sectionLabel")}
          </p>
          <h2 className="font-heading text-center text-4xl tracking-tight sm:text-5xl">
            {t("sectionTitle")}
          </h2>
        </div>
      </RevealOnScroll>

      <div className="mt-10 sm:mt-12">
        <LawCarousel laws={lawData} />
      </div>
    </section>
  );
}
