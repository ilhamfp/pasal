import Link from "next/link";
import { frbrToPath } from "@/lib/frbr";
import { STATUS_LABELS } from "@/lib/legal-status";

interface TimelineNode {
  year: number;
  type: string;
  number: string;
  title: string;
  relationship: string;
  frbrUri: string;
  isCurrent: boolean;
}

interface AmendmentTimelineProps {
  currentWork: {
    year: number;
    number: string;
    title_id: string;
    frbr_uri: string;
    status: string;
  };
  relationships: {
    id: number;
    nameId: string;
    otherWork: {
      id: number;
      title_id: string;
      number: string;
      year: number;
      frbr_uri: string;
      regulation_type_id: number;
    };
  }[];
  regTypeCode: string;
}

const TIMELINE_STATUS_LABELS: Record<string, string> = {
  ...STATUS_LABELS,
  diubah: "Berlaku (dengan perubahan)",
};

export default function AmendmentTimeline({
  currentWork,
  relationships,
  regTypeCode,
}: AmendmentTimelineProps) {
  if (relationships.length === 0) return null;

  const currentNode: TimelineNode = {
    year: currentWork.year,
    type: regTypeCode,
    number: currentWork.number,
    title: currentWork.title_id,
    relationship: "Undang-Undang ini",
    frbrUri: currentWork.frbr_uri,
    isCurrent: true,
  };

  const relatedNodes: TimelineNode[] = relationships.map((rel) => ({
    year: rel.otherWork.year,
    type: regTypeCode,
    number: rel.otherWork.number,
    title: rel.otherWork.title_id,
    relationship: rel.nameId,
    frbrUri: rel.otherWork.frbr_uri,
    isCurrent: false,
  }));

  const nodes = [currentNode, ...relatedNodes].sort((a, b) => a.year - b.year);

  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-heading text-sm mb-4">Riwayat Perubahan</h3>
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

        {nodes.map((node, i) => (
          <div key={i} className="relative pb-5 last:pb-0">
            {/* Dot */}
            <div
              className={`absolute -left-6 top-1 h-[18px] w-[18px] rounded-full border-2 ${
                node.isCurrent
                  ? "bg-primary border-primary"
                  : "bg-card border-border"
              }`}
            />

            <div>
              <p className="text-xs text-muted-foreground">{node.year}</p>
              {node.isCurrent ? (
                <p className="text-sm font-medium">
                  {node.type} {node.number}/{node.year}
                </p>
              ) : (
                <Link
                  href={frbrToPath(node.frbrUri)}
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {node.type} {node.number}/{node.year}
                </Link>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {node.relationship}
              </p>
            </div>
          </div>
        ))}

        {/* Status indicator */}
        <div className="relative pb-0">
          <div className="absolute -left-6 top-1 h-[18px] w-[18px] rounded-full border-2 border-primary bg-primary/20" />
          <p className="text-xs font-medium text-primary">
            Status: {TIMELINE_STATUS_LABELS[currentWork.status] || currentWork.status}
          </p>
        </div>
      </div>
    </div>
  );
}
