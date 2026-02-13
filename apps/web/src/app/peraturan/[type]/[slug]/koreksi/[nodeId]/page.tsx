import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import KoreksiEditor from "./KoreksiEditor";

interface PageProps {
  params: Promise<{ type: string; slug: string; nodeId: string }>;
}

export default async function KoreksiPage({ params }: PageProps) {
  const { type, slug, nodeId } = await params;
  const supabase = await createClient();

  const nodeIdNum = parseInt(nodeId, 10);
  if (isNaN(nodeIdNum)) notFound();

  // Fetch the document node
  const { data: node } = await supabase
    .from("document_nodes")
    .select("id, number, node_type, content_text, heading, pdf_page_start, pdf_page_end, work_id")
    .eq("id", nodeIdNum)
    .single();

  if (!node) notFound();

  // Fetch the work for context
  const { data: work } = await supabase
    .from("works")
    .select("id, title_id, number, year, slug, source_pdf_url")
    .eq("id", node.work_id)
    .single();

  if (!work) notFound();

  const backHref = `/peraturan/${type}/${slug}#pasal-${node.number}`;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <KoreksiEditor
        workId={work.id}
        nodeId={node.id}
        nodeType={node.node_type}
        nodeNumber={node.number}
        currentContent={node.content_text || ""}
        slug={work.slug || slug}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
        pdfPageStart={node.pdf_page_start}
        pdfPageEnd={node.pdf_page_end}
        sourcePdfUrl={work.source_pdf_url}
        lawTitle={work.title_id}
        lawNumber={work.number}
        lawYear={work.year}
        regType={type.toUpperCase()}
        backHref={backHref}
      />
    </div>
  );
}
