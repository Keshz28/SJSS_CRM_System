import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { CompanyScopeProvider } from "@/components/layout/CompanyScopeProvider";
import { MobileNavProvider } from "@/components/layout/MobileNavProvider";
import { getCompanyScope } from "@/lib/company-scope";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { companies, companyId } = await getCompanyScope();

  return (
    <Providers>
      <CompanyScopeProvider value={{ companies, companyId }}>
        <MobileNavProvider>
          <div className="flex min-h-screen bg-dx-bg">
            <Sidebar />
            <div className="flex-1 lg:ml-64 flex flex-col min-h-screen min-w-0">
              {children}
            </div>
          </div>
        </MobileNavProvider>
      </CompanyScopeProvider>
    </Providers>
  );
}
