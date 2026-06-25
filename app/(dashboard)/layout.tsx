import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <Providers>
      <div className="flex min-h-screen bg-dx-bg">
        <Sidebar />
        <div className="flex-1 ml-64 flex flex-col min-h-screen">
          {children}
        </div>
      </div>
    </Providers>
  );
}
