export default function Loading() {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-muted">
      <span className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      Chargement…
    </div>
  );
}
