/**
 * Squelette du sélecteur d'achat.
 *
 * Sert à deux endroits :
 *  - `loading.tsx` : affiché dès le clic sur « Acheter un numéro », avant même
 *    que le serveur ait commencé à répondre ;
 *  - le `<Suspense>` de la page : affiché pendant que la liste des services
 *    HeroSMS (~800 entrées) arrive, alors que l'en-tête et le solde sont déjà
 *    visibles.
 *
 * Il reproduit la même géométrie que <BuyWizard/> (stepper, recherche, lignes
 * de 56 px) pour qu'aucun bloc ne saute quand le vrai contenu le remplace.
 */
export function BuySkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {/* Stepper : figé sur l'étape 1, identique à celui du wizard. */}
      <ol className="flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <li key={n} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                n === 1
                  ? "bg-primary/15 text-primary ring-2 ring-primary"
                  : "bg-border text-muted"
              }`}
            >
              {n}
            </span>
            <span className="hidden h-3 w-12 rounded bg-border sm:block" />
            {n < 3 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-border" />
        <div className="h-11 w-full animate-pulse rounded-lg bg-border" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex min-h-14 animate-pulse items-center gap-3 rounded-xl border border-border bg-background px-3"
            >
              <span className="h-8 w-8 rounded-lg bg-border" />
              <span className="h-3 flex-1 rounded bg-border" />
              <span className="h-3 w-16 rounded bg-border" />
            </div>
          ))}
        </div>
      </section>

      <span className="sr-only">Chargement des services…</span>
    </div>
  );
}
