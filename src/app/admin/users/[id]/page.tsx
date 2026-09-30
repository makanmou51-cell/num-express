import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getUserDetail } from "@/lib/admin";
import { refundExpiredForUser } from "@/lib/activations";
import { Badge, Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { AdjustBalanceForm, RoleForm, EmailForm } from "./user-actions";
import { UserActivity } from "./user-activity";
import { RentalRefundButton } from "./rental-refund-button";
import { formatWhen } from "@/lib/datetime";

export const metadata: Metadata = { title: "Admin — Utilisateur" };

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  /* On solde d'abord ses activations expirees : sinon la fiche affiche
     « En attente du code » sur un numero que le fournisseur a libere depuis
     longtemps, et l'admin croit a un blocage. Le client, lui, ne declenche
     ce nettoyage qu'en revenant sur son espace. */
  await refundExpiredForUser(id);
  const detail = await getUserDetail(id);
  if (!detail) notFound();
  const { user, transactions, activations, rentals } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="text-sm text-primary hover:underline"
        >
          ← Utilisateurs
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          {user.name ?? user.email}
          {user.role === "ADMIN" && (
            <Badge className="bg-slate-800 text-white">admin</Badge>
          )}
        </h1>
        <p className="text-sm text-muted">
          {user.email} · inscrit le{" "}
          {new Date(user.createdAt).toLocaleDateString("fr-FR")}
          {user.referredBy && <> · parrainé par {user.referredBy.email}</>}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted">Solde</p>
          <p className="mt-1 text-xl font-bold">{formatXof(user.balance)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Activations</p>
          <p className="mt-1 text-xl font-bold">{user._count.activations}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Filleuls</p>
          <p className="mt-1 text-xl font-bold">{user._count.referrals}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">E-mail vérifié</p>
          <p className="mt-1 text-xl font-bold">
            {user.emailVerifiedAt ? "Oui" : "Non"}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Ajuster le solde</h2>
          <AdjustBalanceForm userId={user.id} />
        </Card>
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Rôle</h2>
          <p className="text-sm text-muted">
            Rôle actuel : <strong>{user.role}</strong>. Code parrain :{" "}
            <code>{user.referralCode}</code>
          </p>
          <RoleForm userId={user.id} currentRole={user.role} />
        </Card>
      </div>

      <Card className="space-y-3 p-5">
        <div>
          <h2 className="font-semibold">Envoyer un e-mail à ce client</h2>
          <p className="text-sm text-muted">
            Le message part vers <strong>{user.email}</strong>. Utilisez{" "}
            <code>{"{nom}"}</code> pour insérer son prénom automatiquement.
          </p>
        </div>
        <EmailForm userId={user.id} defaultBody={"Bonjour {nom},\n\n"} />
      </Card>

      {rentals.length > 0 && (
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Locations (numéros dédiés)</h2>
          <ul className="divide-y">
            {rentals.map((r) => {
              const label =
                r.status === "ACTIVE"
                  ? "Actif"
                  : r.status === "CANCELLED"
                    ? "Remboursé"
                    : "Expiré";
              const cls =
                r.status === "ACTIVE"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-200 text-gray-600";
              return (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.serviceName ?? r.serviceCode} ·{" "}
                      {r.countryName ?? r.countryCode}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted">
                      +{r.phoneNumber} · {formatWhen(r.createdAt.toISOString())}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">
                    {formatXof(r.priceXof)}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
                  >
                    {label}
                  </span>
                  {r.status === "ACTIVE" && <RentalRefundButton id={r.id} />}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <UserActivity
        transactions={transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          status: t.status,
          createdAt: t.createdAt.toISOString(),
          activationId: t.activationId,
        }))}
        activations={activations.map((a) => ({
          id: a.id,
          serviceCode: a.serviceCode,
          serviceName: a.serviceName,
          countryName: a.countryName,
          countryCode: a.countryCode,
          status: a.status,
          smsCode: a.smsCode,
          priceXof: a.priceXof,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
