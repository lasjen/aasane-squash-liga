import Link from "next/link";
import { Suspense } from "react";

import { adminLogout } from "@/app/actions/admin-auth";
import { getCurrentAdmin } from "@/lib/auth/admin-session";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="border-b border-zinc-200 bg-zinc-900 text-white dark:border-zinc-800">
        <div className="mx-auto flex min-h-14 w-full max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin" className="font-semibold tracking-tight">
            Torsdagsligaen <span className="font-normal text-zinc-400">· Admin</span>
          </Link>
          {/* Leser admin-cookien, så den strømmes inn mens resten vises med en gang. */}
          <Suspense fallback={null}>
            <AdminNav />
          </Suspense>
        </div>
      </header>
      {children}
    </>
  );
}

async function AdminNav() {
  const admin = await getCurrentAdmin();
  if (!admin) return null;

  return (
    <nav className="flex items-center gap-4 text-sm">
      <span className="text-zinc-300">
        {admin.firstName} {admin.lastName}
      </span>
      <form action={adminLogout}>
        <button type="submit" className="font-medium underline">
          Logg ut
        </button>
      </form>
    </nav>
  );
}
