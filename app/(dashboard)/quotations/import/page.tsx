import { Header } from "@/components/layout/Header";
import { getCompanies } from "@/lib/companies";
import { QuotationImport } from "@/components/quotations/QuotationImport";

export default async function ImportQuotationsPage() {
  const companies = await getCompanies();

  return (
    <div className="flex flex-col flex-1">
      <Header
        title="Upload Quotation"
        subtitle="Upload an existing quotation document and record its key details"
      />
      <main className="flex-1 p-6">
        <QuotationImport companies={companies} />
      </main>
    </div>
  );
}
