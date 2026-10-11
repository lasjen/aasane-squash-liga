import Link from "next/link";
import { Suspense } from "react";

import { adminLogout } from "@/app/actions/admin-auth";
import { getCurrentOperator } from "@/lib/auth/admin-session";
import { ROLE_LABELS } from "@/lib/roles";

import { AdminTabs } from "./admin-tabs";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="border-b border-zinc-200 bg-zinc-900 text-white dark:border-zinc-800">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin" className="font-semibold tracking-tight">
            Torsdagsligaen <span className="font-normal text-zinc-400">· Konsoll</span>
          </Link>
          {/* Leser admin-cookien, så den strømmes inn mens resten vises med en gang. */}
          <Suspense fallback={null}>
            <AdminNav />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <TabsForAdmin />
        </Suspense>
      </header>
      {children}
    </>
  );
}

/** Fanene vises bare for innloggede operatører og admins. Admin får i tillegg «Logg». */
async function TabsForAdmin() {
  const operator = await getCurrentOperator();
  return operator ? <AdminTabs isAdmin={operator.role === "admin"} /> : null;
}

async function AdminNav() {
  const admin = await getCurrentOperator();
  if (!admin) return null;

  return (
    <nav className="flex items-center gap-4 text-sm">
      <span className="text-zinc-300">
        {admin.firstName} {admin.lastName}
        <span className="ml-2 rounded bg-zinc-700 px-1.5 py-0.5 text-xs">{ROLE_LABELS[admin.role]}</span>
      </span>
      <form action={adminLogout}>
        <button type="submit" className="font-medium underline">
          Logg ut
        </button>
      </form>
    </nav>
  );
}
