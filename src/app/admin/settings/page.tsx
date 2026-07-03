import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { Card } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Admin — Réglages" };

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Réglages</h1>
        <p className="text-muted">
          Tarification et commission. Ces valeurs surchargent celles du fichier
          .env et s'appliquent immédiatement.
        </p>
      </div>
      <Card className="p-6">
        <SettingsForm settings={settings} />
      </Card>
    </div>
  );
}
