import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getUserDetail } from "@/lib/admin";
import { Badge, Card } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { formatXof } from "@/lib/pricing";
import { AdjustBalanceForm, RoleForm } from "./user-actions";

export const metadata: Metadata = { title: "Admin — Utilisateur" };

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) notFound();
  const { user, transactions, activations } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-primary hover:underline">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Dernières transactions</h2>
          {transactions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Aucune.</p>
          ) : (
            <ul className="divide-y text-sm">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2">
                  <span>
                    {t.type}
                    <span className="ml-2 text-xs text-muted">
                      {new Date(t.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </span>
                  <span
                    className={
                      t.amount >= 0 ? "text-green-700" : "text-red-600"
                    }
                  >
                    {t.amount >= 0 ? "+" : ""}
                    {formatXof(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Dernières activations</h2>
          {activations.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Aucune.</p>
          ) : (
            <ul className="divide-y text-sm">
              {activations.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span>
                    {a.serviceName ?? a.serviceCode} ·{" "}
                    {a.countryName ?? a.countryCode}
                  </span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
