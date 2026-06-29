import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/Header";
import { CompanySettings } from "@/components/settings/CompanySettings";

export default async function SettingsPage() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col flex-1">
      <Header title="Settings" subtitle="Manage your companies and their quotation details" />
      <main className="flex-1 p-4 sm:p-6">
        <CompanySettings companies={companies} />
      </main>
    </div>
  );
}
