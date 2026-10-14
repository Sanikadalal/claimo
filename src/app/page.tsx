import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Claimo</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          Turn your Uber and Rapido receipt emails into a reimbursement-ready PDF.
        </p>
      </header>
      {/* The dashboard reads today's date and the URL, so it renders per request. */}
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
