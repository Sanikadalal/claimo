"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReceiptWithStatus } from "@/lib/types";

const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function defaultRange() {
  const now = new Date();
  return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
}

interface Scan {
  receipts: ReceiptWithStatus[];
  skipped: number;
  tookMs: number;
}

export default function Dashboard() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [range, setRange] = useState(defaultRange);
  const [name, setName] = useState("");
  const [scan, setScan] = useState<Scan | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"scan" | "report" | null>(null);
  const [actionError, setError] = useState<string | null>(null);
  // Sign-in failures come back from the OAuth callback as ?error=...
  const urlError = useSearchParams().get("error");
  const error = actionError ?? urlError;

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setEmail(d.email))
      .catch(() => setEmail(null));
  }, []);

  const chosen = useMemo(
    () => scan?.receipts.filter((r) => selected.has(r.messageId)) ?? [],
    [scan, selected],
  );
  const total = chosen.reduce((sum, r) => sum + r.amountPaise, 0);

  async function findReceipts() {
    setBusy("scan");
    setError(null);
    try {
      const res = await fetch(`/api/receipts?${new URLSearchParams(range)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScan(data);
      setSelected(new Set(data.receipts.filter((r: ReceiptWithStatus) => !r.duplicateOf).map((r: ReceiptWithStatus) => r.messageId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function downloadReport() {
    setBusy("report");
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeName: name, range, messageIds: [...selected] }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: `reimbursement-${range.from}.pdf` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the report");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    await fetch("/api/auth/logout", { method: "POST" });
    setEmail(null);
    setScan(null);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (email === undefined) return <p className="text-sm text-neutral-500">Loading…</p>;

  if (!email) {
    return (
      <div className="rounded-xl border border-neutral-200 p-8 text-center dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Connect your Gmail</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
          Claimo reads only Uber and Rapido receipt emails, with read-only access, and never stores your mail.
        </p>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <a
          href="/api/auth/login"
          className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
        >
          Connect Gmail
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">Connected as {email}</span>
        <button onClick={disconnect} className="text-neutral-500 underline hover:text-neutral-900">
          Disconnect
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {(["from", "to"] as const).map((key) => (
          <label key={key} className="text-sm">
            <span className="mb-1 block text-neutral-600 dark:text-neutral-400">{key === "from" ? "From" : "To"}</span>
            <input
              type="date"
              value={range[key]}
              onChange={(e) => setRange({ ...range, [key]: e.target.value })}
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
            />
          </label>
        ))}
        <button
          onClick={findReceipts}
          disabled={busy !== null}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {busy === "scan" ? "Searching…" : "Find receipts"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {scan && (
        <>
          <p className="text-sm text-neutral-500">
            Found {scan.receipts.length} receipts in {(scan.tookMs / 1000).toFixed(1)}s
            {scan.skipped > 0 && ` · ${scan.skipped} other emails from Uber/Rapido skipped`}
          </p>

          {scan.receipts.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
                  <tr>
                    <th className="w-10 p-3" />
                    <th className="p-3">Date</th>
                    <th className="p-3">Ride</th>
                    <th className="p-3">Route</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.receipts.map((r) => (
                    <tr key={r.messageId} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.has(r.messageId)}
                          disabled={r.duplicateOf !== null}
                          onChange={() => toggle(r.messageId)}
                          aria-label={`Include ride on ${day(r.date)}`}
                        />
                      </td>
                      <td className="whitespace-nowrap p-3">{day(r.date)}</td>
                      <td className="whitespace-nowrap p-3">
                        {r.provider === "uber" ? "Uber" : "Rapido"}
                        {r.rideType && <span className="text-neutral-500"> · {r.rideType}</span>}
                        {r.duplicateOf && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">duplicate</span>
                        )}
                      </td>
                      <td className="max-w-xs truncate p-3 text-neutral-600 dark:text-neutral-400">
                        {r.pickup || r.drop ? `${r.pickup ?? "?"} → ${r.drop ?? "?"}` : "—"}
                      </td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums">{inr(r.amountPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {chosen.length > 0 && (
            <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900">
              <div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{chosen.length} rides selected</p>
                <p className="text-2xl font-semibold tabular-nums">{inr(total)}</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  <span className="mb-1 block text-neutral-600 dark:text-neutral-400">Name on report</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
                  />
                </label>
                <button
                  onClick={downloadReport}
                  disabled={busy !== null || !name.trim()}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
                >
                  {busy === "report" ? "Building PDF…" : "Download PDF report"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
