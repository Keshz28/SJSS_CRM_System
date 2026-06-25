# SJSS CRM — Setup Guide

## Prerequisites
- Node.js 18 or later
- PostgreSQL 14 or later (running locally or on a server)

---

## 1. Configure the Database

Open `.env.local` and update the database connection string:

```
DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/sjss_crm"
```

**To create the database in PostgreSQL:**
```sql
CREATE DATABASE sjss_crm;
```

---

## 2. Run Database Migration

This creates all the tables:

```bash
npm run db:push
```

---

## 3. Seed the Admin User

This creates the first login account:

```bash
npx prisma db seed
```

Default credentials:
- **Email:** admin@sjss.com
- **Password:** admin123

> ⚠️ Change the password after first login (via Settings page).

---

## 4. Start the Application

```bash
npm run dev
```

Open your browser at: **http://localhost:3000**

---

## Daily Use

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the app in development mode |
| `npm run build && npm start` | Run in production mode |
| `npm run db:studio` | Open Prisma Studio (visual database viewer) |

---

## Backup Strategy

### Option A — Automatic PostgreSQL backup (recommended)

Create a scheduled task in Windows to run daily:

```bat
pg_dump -U postgres sjss_crm > C:\Backups\sjss_crm_%date%.sql
```

### Option B — Manual backup

```bash
pg_dump -U postgres sjss_crm > backup.sql
```

Restore:
```bash
psql -U postgres sjss_crm < backup.sql
```

### File Attachments

The `public/uploads/` folder contains all uploaded files. Include this folder in your backup routine.

---

## Project Structure

```
app/
  (auth)/login/          Login page
  (dashboard)/
    dashboard/           Home dashboard
    customers/           Customer list + detail
    quotations/          Quotation list + detail + edit
  api/
    auth/                NextAuth endpoints
    customers/           Customer CRUD API
    quotations/          Quotation CRUD + PDF API
    uploads/             File upload/delete API
components/
  layout/                Sidebar + Header
  customers/             Customer list + form
  quotations/            Quotation list + form + detail
lib/
  prisma.ts              Database client
  auth.ts                Authentication config
  utils.ts               Formatting helpers
  quotation-number.ts    Auto quotation number generator
  pdf-document.tsx       PDF template
prisma/
  schema.prisma          Database schema
  seed.ts                Sample data + admin user
```

---

## Adding More Users

Use Prisma Studio (`npm run db:studio`) to add users directly, or build a user management page later.

Passwords must be bcrypt-hashed. To hash a password:

```js
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('yourpassword', 12);
console.log(hash);
```
