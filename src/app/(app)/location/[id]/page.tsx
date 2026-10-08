import { BackLink } from "@/components/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getRentalForUser,
  getRentalMessages,
  durationLabel,
} from "@/lib/rentals";
import { ServiceIcon } from "@/components/service-icon";
import { formatXof } from "@/lib/pricing";
import { RentalLive } from "./rental-live";
import { CancelRentalButton } from "./cancel-rental-button";
import { WhatsAppGuide } from "@/components/whatsapp-guide";

export const metadata: Metadata = { title: "Numéro loué" };

export default async function RentalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const rental = await getRentalForUser(user.id, id);
  if (!rental) notFound();

  const sms = await getRentalMessages(rental);
  const expired = rental.endsAt.getTime() < Date.now();

  return (
    <div className="space-y-5">
      <div>
        <BackLink href="/numbers" label="Mes numéros" />
        <h1 className="mt-1 flex flex-wrap items-center gap-2.5 text-2xl font-bold">
          <ServiceIcon code={rental.serviceCode} className="h-9 w-9 text-sm" />
          {rental.serviceName ?? rental.serviceCode} loué · {rental.countryName}
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary">
            {durationLabel(rental.durationHours)}
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Payé {formatXof(rental.priceXof)} · numéro dédié, reçoit plusieurs SMS
          pendant toute la durée.
        </p>
      </div>

      {rental.serviceCode === "wa" && (
        <WhatsAppGuide countryName={rental.countryName} />
      )}

      <RentalLive
        id={rental.id}
        startedAt={rental.createdAt.toISOString()}
        initial={{
          status: expired ? "EXPIRED" : rental.status,
          endsAt: rental.endsAt.toISOString(),
          phoneNumber: rental.phoneNumber,
          sms,
        }}
      />

      {rental.status === "ACTIVE" && !expired && (
        <CancelRentalButton
          id={rental.id}
          createdAt={rental.createdAt.toISOString()}
        />
      )}
    </div>
  );
}
