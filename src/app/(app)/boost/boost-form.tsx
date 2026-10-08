"use client";

import { useMemo, useState } from "react";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink } from "@/components/ui";
import {
  IconCheck,
  IconCheckCircle,
  IconClock,
  IconRefresh,
} from "@/components/icons";
import { ServiceIcon } from "@/components/service-icon";
import { formatXof } from "@/lib/pricing";
import { placeBoostOrderAction, type BoostActionState } from "./actions";
import type { BoostNetwork } from "@/lib/boost/catalog";

/** Paliers proposés en un tap ; ceux hors bornes du tier sont filtrés. */
const QTY_PRESETS = [100, 500, 1000, 5000];

function priceXof(pricePer1000: number, qty: number): number {
  const raw = (qty / 1000) * pricePer1000;
  return Math.max(5, Math.ceil(raw / 5) * 5);
}

function SubmitButton({ price }: { price: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Commande en cours…" : `Acheter · ${formatXof(price)}`}
    </Button>
  );
}

export function BoostForm({
  catalog,
  balance,
}: {
  catalog: BoostNetwork[];
  balance: number;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<BoostActionState, FormData>(
    placeBoostOrderAction,
    undefined,
  );

  const [netKey, setNetKey] = useState(catalog[0]?.key ?? "");
  const network = catalog.find((n) => n.key === netKey) ?? catalog[0];

  const [svcKey, setSvcKey] = useState(network?.services[0]?.key ?? "");
  const service =
    network?.services.find((s) => s.key === svcKey) ?? network?.services[0];

  const [tierKey, setTierKey] = useState(service?.tiers[0]?.key ?? "");
  const tier = service?.tiers.find((t) => t.key === tierKey) ?? service?.tiers[0];

  const [link, setLink] = useState("");
  const [qty, setQty] = useState<number>(tier?.min ?? 100);

  // Quand on change de réseau/service, on réinitialise les sous-choix.
  function pickNetwork(k: string) {
    const n = catalog.find((x) => x.key === k);
    setNetKey(k);
    const s0 = n?.services[0];
    setSvcKey(s0?.key ?? "");
    setTierKey(s0?.tiers[0]?.key ?? "");
    setQty(s0?.tiers[0]?.min ?? 100);
  }
  function pickService(k: string) {
    const s = network?.services.find((x) => x.key === k);
    setSvcKey(k);
    setTierKey(s?.tiers[0]?.key ?? "");
    setQty(s?.tiers[0]?.min ?? 100);
  }

  const price = useMemo(
    () => (tier ? priceXof(tier.pricePer1000Xof, qty || 0) : 0),
    [tier, qty],
  );
  /** Ce qu'il manque au client, calculé en direct pendant qu'il choisit. */
  const missing = Math.max(0, price - balance);

  // Rafraîchit la liste des commandes après un achat réussi.
  useEffect(() => {
    if (state && "success" in state) {
      setLink("");
      router.refresh();
    }
  }, [state, router]);

  if (!network || !service || !tier) {
    return (
      <Alert variant="info">
        Le service Boost n'est pas encore configuré. Réessaie bientôt.
      </Alert>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form action={formAction} className="space-y-5 lg:col-span-2">
        {state && "error" in state && (
          <Alert variant="error">{state.error}</Alert>
        )}
        {state && "success" in state && (
          <Alert variant="success">
            Commande lancée ! Suis son avancement dans « Mes commandes » ci-dessous.
          </Alert>
        )}

        {/* Réseau */}
        <div>
          <p className="mb-2 text-sm font-medium">Réseau</p>
          <div className="flex flex-wrap gap-2">
            {catalog.map((n) => (
              <button
                key={n.key}
                type="button"
                onClick={() => pickNetwork(n.key)}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all ${
                  n.key === netKey
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-white text-foreground hover:border-primary/40"
                }`}
              >
                <ServiceIcon code={n.icon} className="h-6 w-6 shrink-0" />
                {n.label}
              </button>
            ))}
          </div>
        </div>

        {/* Service */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Service</label>
          <select
            value={svcKey}
            onChange={(e) => pickService(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 min-h-11 py-2.5 text-base focus:border-primary"
          >
            {network.services.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Qualité / type — en cartes plutôt qu'en liste déroulante : le prix
            et le délai étaient cachés derrière un menu gris qu'il fallait
            ouvrir. Quand il n'y a qu'une seule qualité, on n'affiche rien. */}
        {service.tiers.length > 1 && (
          <div>
            <p id="tier-label" className="mb-2 block text-sm font-medium">
              Type / Qualité
            </p>
            <div
              role="radiogroup"
              aria-labelledby="tier-label"
              className="space-y-2"
            >
              {service.tiers.map((t) => {
                const on = t.key === tierKey;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setTierKey(t.key);
                      setQty(t.min);
                    }}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                      on
                        ? "border-primary bg-primary/10"
                        : "border-border bg-white active:bg-gray-100"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {t.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        <span className="tabular-nums">
                          {t.pricePer1000Xof.toLocaleString("fr-FR")} F CFA
                        </span>{" "}
                        / 1 000 · Livré en {t.eta} · Recharge {t.refill}
                      </span>
                    </span>
                    {on && (
                      <IconCheck className="h-5 w-5 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Lien */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Lien</label>
          {/* Le client colle « tiktok.com/@moi » comme dans l'exemple affiché
              juste en dessous, et le serveur refusait faute de schéma. On
              complète le « https:// » manquant quand il quitte le champ.
              Deux précautions : on ne préfixe JAMAIS une valeur vide (on
              enverrait « https:// » tout seul, rejeté par le serveur), et on
              n'utilise pas `type="url"` — la bulle de validation native se
              déclencherait avant notre normalisation. */}
          <input
            name="link"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onBlur={() => {
              const v = link.trim();
              if (!v) return;
              if (!/^https?:\/\//i.test(v)) setLink(`https://${v}`);
              else if (v !== link) setLink(v);
            }}
            required
            placeholder={service.linkHint}
            className="min-h-11 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-base focus:border-primary"
          />
        </div>

        {/* Quantité — raccourcis tapables AVANT le champ libre. Il fallait
            sinon sortir le clavier et deviner un nombre, sans voir le prix
            correspondant avant d'avoir validé. Les paliers hors bornes du
            tier sont écartés. */}
        <div>
          <p id="qty-label" className="mb-2 block text-sm font-medium">
            Quantité
          </p>
          <div
            role="radiogroup"
            aria-labelledby="qty-label"
            className="grid grid-cols-2 gap-2"
          >
            {QTY_PRESETS.filter(
              (n) => n >= tier.min && n <= tier.max,
            ).map((n) => {
              const on = qty === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setQty(n)}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-xl border-2 px-2 transition-colors ${
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-white active:bg-gray-100"
                  }`}
                >
                  <span className="text-base font-bold tabular-nums">
                    {n.toLocaleString("fr-FR")}
                  </span>
                  <span className="text-xs tabular-nums opacity-80">
                    {formatXof(priceXof(tier.pricePer1000Xof, n))}
                  </span>
                </button>
              );
            })}
          </div>

          <label
            htmlFor="quantity"
            className="mb-1.5 mt-3 block text-sm text-muted"
          >
            Ou une quantité précise
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            value={qty}
            min={tier.min}
            max={tier.max}
            onChange={(e) => setQty(Number(e.target.value))}
            required
            className="min-h-11 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-base focus:border-primary"
          />
          <p className="mt-1 text-xs text-muted">
            Min <span className="tabular-nums">{tier.min.toLocaleString("fr-FR")}</span>{" "}
            · Max{" "}
            <span className="tabular-nums">{tier.max.toLocaleString("fr-FR")}</span>
          </p>
        </div>

        {/* Prix + solde. Le solde n'apparaissait nulle part : le client
            remplissait tout le formulaire, validait, attendait, et se prenait
            « solde insuffisant » en rouge — sans savoir combien il lui
            manquait ni où recharger. */}
        <div
          className={`rounded-xl border px-4 py-3 ${
            missing > 0
              ? "border-warning/30 bg-warning/5"
              : "border-primary/20 bg-primary/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Prix</span>
            <span
              className={`text-2xl font-extrabold tabular-nums ${
                missing > 0 ? "text-warning" : "text-primary"
              }`}
            >
              {formatXof(price)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-muted">Ton solde</span>
            <span className="tabular-nums text-muted">
              {formatXof(balance)}
            </span>
          </div>
          {missing > 0 && (
            <p className="mt-2 text-sm font-semibold text-warning">
              Il te manque{" "}
              <span className="tabular-nums">{formatXof(missing)}</span>
            </p>
          )}
        </div>

        <input type="hidden" name="network" value={netKey} />
        <input type="hidden" name="service" value={svcKey} />
        <input type="hidden" name="tier" value={tierKey} />

        {/* Le contrôle serveur reste la vérité (le solde affiché ici peut être
            périmé) : ce bouton est du confort, pas une sécurité. */}
        {missing > 0 ? (
          <ButtonLink
            href="/wallet"
            variant="accent"
            size="lg"
            className="w-full"
          >
            Recharger mon solde
          </ButtonLink>
        ) : (
          <SubmitButton price={price} />
        )}
      </form>

      {/* Remarques */}
      <aside className="space-y-3">
        <div className="rounded-2xl border border-border bg-card p-5 text-sm">
          <p className="font-semibold">Bon à savoir</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li className="flex items-start gap-2">
              <IconClock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Livraison indicative : <strong>{tier.eta}</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <IconRefresh className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Recharge (refill) : <strong>{tier.refill}</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Assure-toi que le compte est <strong>public</strong> et ne change pas le nom d&apos;utilisateur pendant la livraison.</span>
            </li>
            <li className="flex items-start gap-2">
              <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Remboursement automatique si la commande est annulée par le fournisseur.</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
