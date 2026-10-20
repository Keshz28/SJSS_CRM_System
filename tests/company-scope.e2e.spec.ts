import { loginWithEmail } from "./helpers/auth";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();
const customerIds: string[] = [], projectIds: string[] = [], quoteIds: string[] = [], visitIds: string[] = [];
const tag = randomUUID().slice(0, 8);
let companies: { id: string; name: string }[];
async function login(api: APIRequestContext) {
  await loginWithEmail(api);
  expect((await (await api.get("/api/auth/session")).json()).user.role).toBe("ADMIN");
}
async function customer(api: APIRequestContext, company: string, name: string) {
  const response = await api.post("/api/customers", { data: { companyId: company, name } });
  expect(response.status()).toBe(201);
  const value = await response.json(); customerIds.push(value.id); return value;
}
async function selectCompany(page: Page, name: string) {
  await page.bringToFront();
  const button = page.getByRole("group", { name: "Filter the whole system by company" }).getByRole("button", { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(button).toBeEnabled();
}
function stat(page: Page, label: string) {
  return page.locator(".dx-card:visible").filter({ has: page.getByText(label, { exact: true }) }).locator("p").last();
}
async function pdfText(body: Buffer) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(body), useSystemFonts: true });
  const document = await task.promise;
  try {
    const texts: string[] = [];
    for (let i = 1; i <= document.numPages; i++) {
      const content = await (await document.getPage(i)).getTextContent();
      texts.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    }
    return texts.join(" ").replace(/\s+/g, " ");
  } finally { await task.destroy(); }
}
test.beforeEach(async ({ request, page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local test instance required");
  await login(request);
  await page.context().addCookies((await request.storageState()).cookies);
  companies = await (await request.get("/api/companies")).json();
});
test.afterAll(async () => {
  await prisma.siteVisit.deleteMany({ where: { id: { in: visitIds } } });
  await prisma.quotation.deleteMany({ where: { id: { in: quoteIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
  await prisma.$disconnect();
});

test("customers with no business history count in their company, combined totals add up, and APIs inherit the selection", async ({ page, request }) => {
  const a = await customer(request, companies[0].id, `Scope A ${tag}`);
  const b = await customer(request, companies[1].id, `Scope B ${tag}`);
  const counts = await Promise.all(companies.map((c) => prisma.customer.count({ where: { isActive: true, companyId: c.id } })));
  const all = await prisma.customer.count({ where: { isActive: true } });
  expect(counts.reduce((sum, count) => sum + count, 0)).toBe(all);
  await page.goto("/dashboard");
  for (const [index, co] of companies.entries()) {
    await selectCompany(page, co.name);
    await expect(page.getByRole("link", { name: /^Total Customers/ })).toContainText(String(counts[index]));
    await page.goto("/customers");
    await expect(stat(page, "Total Customers")).toHaveText(String(counts[index]));
    await expect(page.getByRole("link", { name: index === 0 ? a.name : b.name, exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: index === 0 ? b.name : a.name, exact: false })).toHaveCount(0);
    const response = await page.request.get(`/api/customers?search=${tag}`);
    const results = (await response.json()).customers;
    expect(results.map((c: { id: string }) => c.id)).toEqual([index === 0 ? a.id : b.id]);
    await page.goto("/dashboard");
  }
  await selectCompany(page, "All companies");
  await expect(page.getByRole("link", { name: /^Total Customers/ })).toContainText(String(all));
  await page.goto("/customers");
  await expect(stat(page, "Total Customers")).toHaveText(String(all));
  await expect(page.getByRole("link", { name: a.name, exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: b.name, exact: false })).toBeVisible();
});

test("project form creates its customer on the same page and company switches clear foreign selections", async ({ page, request }) => {
  const a = await customer(request, companies[0].id, `Existing A ${tag}`);
  const b = await customer(request, companies[1].id, `Existing B ${tag}`);
  await page.goto("/projects/new");
  const company = page.getByLabel("Company", { exact: true });
  const picker = page.getByLabel("Customer", { exact: true });
  await company.selectOption(companies[0].id);
  await expect(picker.locator(`option[value="${a.id}"]`)).toHaveCount(1);
  await expect(picker.locator(`option[value="${b.id}"]`)).toHaveCount(0);
  await picker.selectOption(a.id);
  await company.selectOption(companies[1].id);
  await expect(picker).toHaveValue("");
  await expect(picker.locator(`option[value="${a.id}"]`)).toHaveCount(0);
  await expect(picker.locator(`option[value="${b.id}"]`)).toHaveCount(1);
  await page.getByLabel("Project name", { exact: true }).fill(`Inline ${tag}`);
  await selectCompany(page, companies[0].name);
  await expect(company).toHaveValue(companies[0].id);
  await expect(company).toBeDisabled();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(`Inline ${tag}`);
  await page.getByRole("button", { name: "Add new customer", exact: true }).click();
  await page.getByRole("textbox", { name: "Customer name" }).fill(`Inline customer ${tag}`);
  await page.getByRole("textbox", { name: "Contact person", exact: true }).fill("Site contact");
  await page.getByRole("textbox", { name: "Customer phone", exact: true }).fill("0123456789");
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await page.waitForURL(/\/projects\/(?!new)[^/]+$/);
  const id = new URL(page.url()).pathname.split("/").pop()!; projectIds.push(id);
  const project = await prisma.project.findUniqueOrThrow({ where: { id }, include: { customer: true } });
  customerIds.push(project.customerId!);
  expect(project.companyId).toBe(companies[0].id);
  expect(project.customer?.companyId).toBe(companies[0].id);
  expect(project.customer?.phone).toBe("0123456789");
  await page.goto("/customers");
  await expect(page.getByRole("link", { name: `Inline customer ${tag}`, exact: false })).toBeVisible();
  await selectCompany(page, companies[1].name);
  await expect(page.getByRole("link", { name: `Inline customer ${tag}`, exact: false })).toHaveCount(0);
});

test("server rejects cross-company links and imports same-named customers independently", async ({ request }) => {
  const a = await customer(request, companies[0].id, `Guard A ${tag}`);
  const b = await customer(request, companies[1].id, `Guard B ${tag}`);
  const response = await request.post("/api/projects", { data: { name: `Guard ${tag}`, companyId: companies[0].id, customerId: a.id } });
  const p = await response.json(); projectIds.push(p.id);
  expect(response.status()).toBe(201);
  expect((await request.post("/api/projects", { data: { name: "Bad", companyId: companies[0].id, customerId: b.id } })).status()).toBe(400);
  expect((await request.patch(`/api/projects/${p.id}`, { data: { customerId: b.id } })).status()).toBe(400);
  expect((await request.post("/api/site-visits", { data: { title: "Bad", companyId: companies[0].id, customerId: b.id } })).status()).toBe(400);
  const items = [{ description: "Work", quantity: 1, unitPrice: 100 }];
  expect((await request.post("/api/quotations", { data: { companyId: companies[0].id, customerId: b.id, items } })).status()).toBe(400);
  const quoteResponse = await request.post("/api/quotations", { data: { companyId: companies[0].id, customerId: a.id, items } });
  expect(quoteResponse.status()).toBe(201);
  const q = await quoteResponse.json(); quoteIds.push(q.id);
  expect((await request.put(`/api/quotations/${q.id}`, { data: { customerId: b.id } })).status()).toBe(400);
  expect((await request.put(`/api/customers/${a.id}`, { data: { name: a.name, companyId: companies[1].id } })).status()).toBe(409);
  const name = `Same name ${tag}`;
  const imported = await request.post("/api/quotations/import", { data: companies.map((c) => ({ companyId: c.id, companyName: name, amount: 5 })) });
  expect((await imported.json()).imported).toBe(2);
  const importedCustomers = await prisma.customer.findMany({ where: { name }, include: { quotations: true } });
  for (const c of importedCustomers) { customerIds.push(c.id); quoteIds.push(...c.quotations.map((q) => q.id)); }
  expect(importedCustomers).toHaveLength(2);
  expect(new Set(importedCustomers.map((c) => c.companyId)).size).toBe(2);
  for (const c of importedCustomers) expect(c.quotations.every((q) => q.companyId === c.companyId)).toBeTruthy();
});

test("report screens and all PDF periods use the selected company and correct accepted values", async ({ page, request }) => {
  test.setTimeout(120000);
  const a = await customer(request, companies[0].id, `Report A ${tag}`);
  const b = await customer(request, companies[1].id, `Report B ${tag}`);
  for (const [companyId, customerId, amount, status] of [
    [companies[0].id, a.id, 1234.56, "ACCEPTED"], [companies[0].id, a.id, 200, "DRAFT"],
    [companies[1].id, b.id, 2345.67, "ACCEPTED"], [companies[1].id, b.id, 300, "REJECTED"],
  ] as const) {
    const response = await request.post("/api/quotations", { data: { companyId, customerId, items: [{ description: "Report check", quantity: 1, unitPrice: amount }] } });
    expect(response.status()).toBe(201);
    const q = await response.json(); quoteIds.push(q.id);
    expect((await request.put(`/api/quotations/${q.id}`, { data: { status } })).ok()).toBeTruthy();
  }
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/reports");
  for (const co of [...companies, { id: "", name: "All companies" }]) {
    await selectCompany(page, co.name);
    const where = co.id ? { companyId: co.id } : {};
    const count = await prisma.quotation.count({ where });
    const accepted = await prisma.quotation.aggregate({ where: { ...where, status: "ACCEPTED" }, _sum: { totalAmount: true } });
    const amount = Number(accepted._sum.totalAmount || 0);
    await expect(stat(page, "Total Quotations")).toHaveText(String(count));
    await expect(stat(page, "Accepted Quotation Value")).toContainText(amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    for (const period of ["weekly", "monthly", "yearly"]) {
      await page.getByRole("button", { name: period[0].toUpperCase() + period.slice(1), exact: true }).click();
      const href = await page.getByRole("link", { name: "Download PDF", exact: true }).getAttribute("href");
      expect(href).toContain(`company=${co.id}`);
      // Simulate another tab changing the cookie: export must retain the displayed scope.
      await page.context().addCookies([{ name: "company-scope", value: co.id ? "" : companies[1].id, url: "http://localhost:3000" }]);
      const pdf = await page.request.get(href!);
      expect(pdf.status()).toBe(200);
      expect(pdf.headers()["content-type"]).toContain("application/pdf");
      const text = await pdfText(await pdf.body());
      expect(text).toContain(co.name);
      expect(text).toContain(amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      expect(text).toContain("ACCEPTED QUOTATION VALUE");
      if (co.id) {
        expect(text).toContain(co.id === companies[0].id ? a.name : b.name);
        expect(text).not.toContain(co.id === companies[0].id ? b.name : a.name);
      } else { expect(text).toContain(a.name); expect(text).toContain(b.name); }
      await page.context().addCookies([{ name: "company-scope", value: co.id, url: "http://localhost:3000" }]);
    }
  }
  expect(errors).toEqual([]);
});

test("quotation and capture choices, record lists, and new customers stay in their company's workspace", async ({ page, request }) => {
  test.setTimeout(120000);
  const a = await customer(request, companies[0].id, `Picker A ${tag}`);
  const b = await customer(request, companies[1].id, `Picker B ${tag}`);
  const projects: { id: string; name: string }[] = [];
  const visits: { id: string; title: string }[] = [];
  const quotes: { id: string; quotationNumber: string }[] = [];
  for (const [index, c] of [a, b].entries()) {
    const p = await (await request.post("/api/projects", { data: { companyId: c.companyId, customerId: c.id, name: `Picker project ${index} ${tag}` } })).json();
    projects.push(p); projectIds.push(p.id);
    const v = await (await request.post("/api/site-visits", { data: { companyId: c.companyId, projectId: p.id, title: `Picker visit ${index} ${tag}` } })).json();
    visits.push({ id: v.id, title: `Picker visit ${index} ${tag}` }); visitIds.push(v.id);
    const q = await (await request.post("/api/quotations", { data: { companyId: c.companyId, customerId: c.id, items: [{ description: "Picker check", quantity: 1, unitPrice: 1 }] } })).json();
    quotes.push(q); quoteIds.push(q.id);
  }
  await page.goto("/quotations/new");
  const company = page.getByRole("combobox", { name: "Company", exact: true });
  const picker = page.getByRole("combobox", { name: "Customer", exact: true });
  await company.selectOption(companies[0].id);
  await picker.selectOption(a.id);
  await company.selectOption(companies[1].id);
  await expect(picker).toHaveValue("");
  await expect(picker.locator(`option[value="${a.id}"]`)).toHaveCount(0);
  await expect(picker.locator(`option[value="${b.id}"]`)).toHaveCount(1);
  await page.goto("/site-visits/new");
  await page.locator("summary").click();
  await company.selectOption(companies[1].id);
  await page.getByRole("button", { name: "Existing customer", exact: true }).click();
  const visitPicker = page.getByRole("combobox", { name: "Select customer", exact: true });
  await visitPicker.selectOption(b.id);
  await company.selectOption(companies[0].id);
  await expect(visitPicker).toHaveValue("");
  await expect(visitPicker.locator(`option[value="${b.id}"]`)).toHaveCount(0);
  const projectPicker = page.getByRole("combobox", { name: "Project", exact: true });
  await expect(projectPicker.locator(`option[value="${projects[0].id}"]`)).toHaveCount(1);
  await expect(projectPicker.locator(`option[value="${projects[1].id}"]`)).toHaveCount(0);
  await selectCompany(page, companies[1].name);
  await page.locator("summary").click();
  await expect(company).toHaveValue(companies[1].id);
  await expect(company).toBeDisabled();
  await selectCompany(page, "All companies");
  await page.goto(`/site-visits/new?projectId=${projects[0].id}`);
  await expect(projectPicker).toHaveValue(projects[0].id);
  await selectCompany(page, companies[1].name);
  await page.waitForURL((url) => url.pathname === "/site-visits/new" && !url.search);
  await expect(projectPicker).toHaveValue("");
  await page.goto("/projects");
  await expect(page.getByRole("link", { name: projects[1].name, exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: projects[0].name, exact: false })).toHaveCount(0);
  await page.goto("/site-visits");
  await expect(page.getByRole("link", { name: visits[1].title, exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: visits[0].title, exact: false })).toHaveCount(0);
  await page.goto("/quotations");
  await expect(page.getByRole("cell", { name: quotes[1].quotationNumber, exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: quotes[0].quotationNumber, exact: true })).toHaveCount(0);
  for (const [url, idA, idB, key] of [
    ["/api/projects", projects[0].id, projects[1].id, null],
    ["/api/site-visits", visits[0].id, visits[1].id, "visits"],
    ["/api/quotations", quotes[0].id, quotes[1].id, "quotations"],
  ] as const) {
    const data = await (await page.request.get(url)).json();
    const records: { id: string; companyId: string }[] = key ? data[key] : data;
    expect(records.some((r) => r.id === idB)).toBeTruthy();
    expect(records.some((r) => r.id === idA)).toBeFalsy();
    expect(records.every((r) => r.companyId === companies[1].id)).toBeTruthy();
  }
  await page.goto("/customers/new");
  const owner = page.getByRole("combobox", { name: "CRM company", exact: false });
  await expect(owner).toHaveValue(companies[1].id);
  await expect(owner).toBeDisabled();
  await page.getByRole("textbox", { name: "Company / Customer Name", exact: false }).fill(`Form customer ${tag}`);
  await page.getByRole("button", { name: "Create Customer", exact: true }).click();
  await page.waitForURL("**/customers");
  const saved = await prisma.customer.findFirstOrThrow({ where: { name: `Form customer ${tag}` } }); customerIds.push(saved.id);
  expect(saved.companyId).toBe(companies[1].id);
});
