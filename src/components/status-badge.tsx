import { Badge } from "@/components/ui";

const MAP: Record<string, { label: string; className: string }> = {
  WAITING_CODE: { label: "En attente du code", className: "bg-amber-100 text-amber-800" },
  RECEIVED: { label: "Code reçu", className: "bg-green-100 text-green-800" },
  COMPLETED: { label: "Terminé", className: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Annulé", className: "bg-gray-200 text-gray-700" },
  REFUNDED: { label: "Remboursé", className: "bg-blue-100 text-blue-800" },
  EXPIRED: { label: "Expiré · remboursé", className: "bg-blue-100 text-blue-800" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, className: "bg-gray-200 text-gray-700" };
  return <Badge className={s.className}>{s.label}</Badge>;
}
