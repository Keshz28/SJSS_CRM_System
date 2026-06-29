import { Header } from "@/components/layout/Header";
import { getCompanyScope } from "@/lib/company-scope";
import { QuotationImport } from "@/components/quotations/QuotationImport";

export default async function ImportQuotationsPage() {
  const { companies, companyId } = await getCompanyScope();

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Upload Quotation"
        subtitle="Upload an existing quotation document and record its key details"
      />
      <main className="flex-1 p-4 sm:p-6">
        <QuotationImport companies={companies} defaultCompanyId={companyId} />
      </main>
    </div>
  );
}
