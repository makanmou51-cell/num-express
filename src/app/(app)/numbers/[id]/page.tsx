import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getActivation } from "@/lib/activations";
import { isGrizzlyMock } from "@/lib/grizzly/client";
import { formatXof } from "@/lib/pricing";
import { ActivationLive } from "./activation-live";

export const metadata: Metadata = { title: "Suivi du numéro" };

export default async function ActivationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const activation = await getActivation(user.id, id);
  if (!activation) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <Link href="/numbers" className="text-sm text-primary hover:underline">
          ← Mes numéros
        </Link>
        <h1 className="mt-1 text-2xl font-bold">
          {activation.serviceName ?? activation.serviceCode} ·{" "}
          {activation.countryName ?? activation.countryCode}
        </h1>
        <p className="text-sm text-muted">
          Payé {formatXof(activation.priceXof)} ·{" "}
          {new Date(activation.createdAt).toLocaleString("fr-FR")}
        </p>
      </div>

      <ActivationLive
        isMock={isGrizzlyMock}
        initial={{
          id: activation.id,
          status: activation.status,
          smsCode: activation.smsCode,
          phoneNumber: activation.phoneNumber,
          expiresAt: activation.expiresAt
            ? activation.expiresAt.toISOString()
            : null,
        }}
      />
    </div>
  );
}
