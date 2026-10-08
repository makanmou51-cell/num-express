import { BuySkeleton } from "./buy-skeleton";

/**
 * Affiché INSTANTANÉMENT au clic sur « Acheter un numéro », sans attendre le
 * serveur. Remplace le spinner générique du groupe (app) par la vraie forme
 * de la page : l'utilisateur voit tout de suite qu'il est arrivé.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Acheter un numéro</h1>
          <span className="block h-3 w-52 animate-pulse rounded bg-border" />
        </div>
        <span className="h-14 w-28 shrink-0 animate-pulse rounded-xl bg-border" />
      </div>
      <BuySkeleton />
    </div>
  );
}
