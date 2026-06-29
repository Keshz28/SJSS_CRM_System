import { Header } from "@/components/layout/Header";
import { CustomerForm } from "@/components/customers/CustomerForm";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col flex-1">
      <Header title="Add Customer" subtitle="Create a new customer record" />
      <main className="flex-1 p-4 sm:p-6">
        <CustomerForm />
      </main>
    </div>
  );
}
