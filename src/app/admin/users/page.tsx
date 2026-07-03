import Link from "next/link";
import type { Metadata } from "next";
import { listUsers } from "@/lib/admin";
import { Badge, Card, Input } from "@/components/ui";
import { formatXof } from "@/lib/pricing";

export const metadata: Metadata = { title: "Admin — Utilisateurs" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const users = await listUsers(q?.trim() || undefined);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Utilisateurs</h1>

      <form method="get" className="max-w-md">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher par e-mail, nom ou code parrain…"
        />
      </form>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Utilisateur</th>
              <th className="px-4 py-3 font-medium">Solde</th>
              <th className="px-4 py-3 font-medium">Achats</th>
              <th className="px-4 py-3 font-medium">Filleuls</th>
              <th className="px-4 py-3 font-medium">Inscrit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {u.name ?? u.email}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>{u.email}</span>
                    {u.role === "ADMIN" && (
                      <Badge className="bg-slate-800 text-white">admin</Badge>
                    )}
                    {!u.emailVerifiedAt && (
                      <Badge className="bg-amber-100 text-amber-800">
                        non vérifié
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{formatXof(u.balance)}</td>
                <td className="px-4 py-3">{u._count.activations}</td>
                <td className="px-4 py-3">{u._count.referrals}</td>
                <td className="px-4 py-3 text-muted">
                  {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Aucun utilisateur trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
