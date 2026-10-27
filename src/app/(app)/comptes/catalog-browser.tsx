"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui";
import { AccountBuyForm } from "./buy-form";

/**
 * Navigateur du catalogue « Comptes » : onglets par réseau (TikTok, Facebook
 * par pays, Instagram) + recherche transversale.
 *
 * Pourquoi des onglets plutôt qu'une longue page : 6 sections empilées
 * poussaient les Instagram hors de vue ; le client choisit son réseau et ne
 * voit que ça. La recherche, elle, fouille TOUTES les sections d'un coup
 * (« france », « us », « 2fa »…). Les produits sont toujours présentés du
 * petit prix au grand.
 */

export interface BrowserProduct {
  id_product: number;
  name: string;
  desc: string | null;
  quantity: number;
  priceXof: number;
}
export interface BrowserSection {
  label: string;
  products: BrowserProduct[];
}

export function CatalogBrowser({ sections }: { sections: BrowserSection[] }) {
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const searching = query.length > 0;

  // Du petit prix au grand, une fois pour toutes.
  const sorted = useMemo(
    () =>
      sections.map((s) => ({
        ...s,
        products: [...s.products].sort((a, b) => a.priceXof - b.priceXof),
      })),
    [sections],
  );

  // Recherche : toutes les sections filtrées. Sinon : l'onglet actif seul.
  const visible: BrowserSection[] = searching
    ? sorted
        .map((s) => ({
          ...s,
          products: s.products.filter((p) =>
            `${p.name} ${p.desc ?? ""} ${s.label}`
              .toLowerCase()
              .includes(query),
          ),
        }))
        .filter((s) => s.products.length > 0)
    : sorted[tab]
      ? [sorted[tab]]
      : [];

  return (
    <div className="space-y-4">
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un compte… (ex : TikTok US, France, 2fa)"
        aria-label="Rechercher un compte"
      />

      {/* Onglets : défilement horizontal sur téléphone, jamais de retour à la
          ligne qui pousserait le contenu. */}
      {!searching && (
        <div
          role="tablist"
          aria-label="Réseaux disponibles"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {sorted.map((s, i) => (
            <button
              key={s.label}
              role="tab"
              aria-selected={i === tab}
              onClick={() => setTab(i)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                i === tab
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-white text-muted hover:text-foreground"
              }`}
            >
              {s.label} ({s.products.length})
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-border bg-white p-5 text-sm text-muted">
          Aucun compte ne correspond à « {q} ». Essaie un autre mot.
        </p>
      ) : (
        visible.map((s) => (
          <section key={s.label} className="space-y-3">
            {searching && (
              <h2 className="text-lg font-semibold">{s.label}</h2>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {s.products.map((p) => (
                <div
                  key={p.id_product}
                  className="rounded-xl border border-border bg-white p-4"
                >
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.desc && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted">
                      {p.desc}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted">Stock : {p.quantity}</p>
                  <AccountBuyForm
                    productId={p.id_product}
                    unitPriceXof={p.priceXof}
                    stock={p.quantity}
                  />
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
