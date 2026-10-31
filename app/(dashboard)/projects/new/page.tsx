import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company-scope";
import { Header } from "@/components/layout/Header";
import { ProjectForm } from "@/components/projects/ProjectForm";
export default async function NewProjectPage() {
  const [{ companies, companyId }, customers] = await Promise.all([
    getCompanyScope(),
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
  ]);
  return (
    <div className="flex flex-col flex-1">
      <Header
        title="New project"
        subtitle="Give the job a name, then start capturing"
      />
      <main className="p-4 sm:p-6">
        <ProjectForm
          companies={companies}
          customers={customers}
          initial={{
            name: "",
            companyId: companyId || companies[0]?.id || "",
            status: "PLANNED",
          }}
        />
      </main>
    </div>
  );
}
