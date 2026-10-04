import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getUserDetail } from "@/lib/admin";
import { refundExpiredForUser } from "@/lib/activations";
import { durationLabel } from "@/lib/rentals";
import { Badge, Card } from "@/components/ui";
import { formatXof } from "@/lib/pricing";
import { AdjustBalanceForm, RoleForm, EmailForm } from "./user-actions";
import { UserActivity } from "./user-activity";

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

      <UserActivity
        transactions={transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          status: t.status,
          createdAt: t.createdAt.toISOString(),
          activationId: t.activationId,
        }))}
        /* Activations ET locations dans la MEME liste : un client ne fait pas
           la difference entre « j'ai pris un numero 20 minutes » et « j'ai
           pris un numero 1 jour ». Les locations vivaient dans un encadre
           separe, et le compteur de la liste les ignorait - une location a
           6 900 F pouvait passer inapercue en balayant la fiche. */
        activations={[
          ...activations.map((a) => ({
            id: a.id,
            serviceCode: a.serviceCode,
            serviceName: a.serviceName,
            countryName: a.countryName,
            countryCode: a.countryCode,
            status: a.status,
            smsCode: a.smsCode,
            priceXof: a.priceXof,
            createdAt: a.createdAt.toISOString(),
            kind: "activation" as const,
            phoneNumber: a.phoneNumber,
            durationLabel: null,
          })),
          ...rentals.map((r) => ({
            id: r.id,
            serviceCode: r.serviceCode,
            serviceName: r.serviceName,
            countryName: r.countryName,
            countryCode: r.countryCode,
            status: r.status,
            smsCode: null,
            priceXof: r.priceXof,
            createdAt: r.createdAt.toISOString(),
            kind: "rental" as const,
            phoneNumber: r.phoneNumber,
            durationLabel: durationLabel(r.durationHours),
          })),
        ].sort((x, y) => y.createdAt.localeCompare(x.createdAt))}
      />
    </div>
  );
}
