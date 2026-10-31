import { getCompanyScope } from "@/lib/company-scope";
import { getReportData } from "@/lib/report-data";
import { Header } from "@/components/layout/Header";
import { ReportsClient } from "./ReportsClient";

export default async function ReportsPage() {
  const { companyId, company } = await getCompanyScope();
  const data = await getReportData(companyId);
  return (
    <div className="flex flex-col flex-1">
      <Header title="Reports & Analytics" subtitle="Business performance overview" />
      <main className="flex-1 p-4 sm:p-6">
        <ReportsClient {...data} companyId={companyId} companyName={company?.name || "All companies"} />
      </main>
    </div>
  );
}
