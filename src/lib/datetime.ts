/**
 * Date relative courte en français : « à l'instant », « il y a 5 min »,
 * « il y a 3 h », puis « 24 juil. » au-delà d'un jour.
 */
export function formatWhen(d: Date | string): string {
  const date = new Date(d);
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffMin < 1440) return `il y a ${Math.floor(diffMin / 60)} h`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
