"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { Nav } from "@/components/nav";
import { WalletButton } from "@/components/wallet-button";
import { useWallet } from "@/hooks/use-wallet";
import { useRegistry, fetchRegistryOwner, REGISTRY_ID } from "@/hooks/use-registry";
import { truncateAddress } from "@/lib/stellar";

// ── Tooltip helper ─────────────────────────────────────────────────────────────
function Help({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block ml-2">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        aria-label="Help"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/30 font-[family-name:var(--font-mono)] text-[9px] text-white/50 hover:border-[#1564FF] hover:text-[#1564FF] transition-colors"
      >
        ?
      </button>
      {show && (
        <span className="absolute left-6 top-1/2 z-50 -translate-y-1/2 w-56 rounded border border-white/10 bg-[#141414] px-3 py-2 font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-white/70 shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  title,
  help,
  children,
}: {
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 p-6">
      <div className="flex items-center mb-5">
        <h2 className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-white/50">
          {title}
        </h2>
        <Help text={help} />
      </div>
      {children}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Artist = { address: string; registered_at_ledger: number };

export default function AdminPage() {
  const { address, isConnected } = useWallet();
  const { register, revoke, state: actionState, error: actionError, reset } = useRegistry();

  const [owner, setOwner] = useState<string | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const isOwner = !!address && !!owner && address === owner;

  // Fetch the contract owner once
  useEffect(() => {
    fetchRegistryOwner().then((o) => {
      setOwner(o);
      setOwnerLoading(false);
    });
  }, []);

  // Fetch artists from Supabase
  const loadArtists = useCallback(async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    setArtistsLoading(true);
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    const { data } = await db
      .from("artists")
      .select("address, registered_at_ledger")
      .eq("revoked", false)
      .order("registered_at_ledger", { ascending: false });
    setArtists(data ?? []);
    setArtistsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadArtists();
  }, [loadArtists]);

  async function handleRegister() {
    if (!newAddress.trim()) return;
    try {
      await register(newAddress.trim());
      setNewAddress("");
      reset();
      await loadArtists();
    } catch {
      /* error shown via actionError */
    }
  }

  async function handleRevoke(artistAddr: string) {
    try {
      await revoke(artistAddr);
      setConfirmRevoke(null);
      reset();
      await loadArtists();
    } catch {
      /* error shown via actionError */
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F4ED]">
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-16 flex flex-col gap-6">
        {/* Page header */}
        <div className="border-b border-white/10 pb-6">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[#1564FF] mb-2">
            Admin
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
            Artist Registry
          </h1>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-white/40">
            Contract: {truncateAddress(REGISTRY_ID, 8, 8)}
          </p>
        </div>

        {/* Section 1 — Access */}
        <Section
          title="Access"
          help="Solo la wallet que desplegó el contrato (el owner) puede registrar o revocar artistas. Conectá esa wallet para operar."
        >
          {!isConnected ? (
            <div className="flex flex-col gap-3">
              <p className="font-[family-name:var(--font-mono)] text-[11px] text-white/50">
                Connect the owner wallet to manage artists.
              </p>
              <WalletButton />
            </div>
          ) : ownerLoading ? (
            <p className="font-[family-name:var(--font-mono)] text-[11px] text-white/40">
              Checking ownership…
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <span
                className={`font-[family-name:var(--font-mono)] text-[11px] ${isOwner ? "text-[#1564FF]" : "text-red-400"}`}
              >
                {isOwner ? "✓ Owner confirmed" : "✗ Not the owner — read-only mode"}
              </span>
              {owner && (
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-white/30">
                  owner: {truncateAddress(owner, 6, 6)}
                </span>
              )}
            </div>
          )}
        </Section>

        {/* Section 2 — Registered artists */}
        <Section
          title="Registered artists"
          help="Lista de wallets que pueden mintear en Molotov. Solo artistas en esta lista pueden crear obras. El indexer la actualiza cada minuto desde la blockchain."
        >
          {artistsLoading ? (
            <p className="font-[family-name:var(--font-mono)] text-[11px] text-white/40">
              Loading…
            </p>
          ) : artists.length === 0 ? (
            <p className="font-[family-name:var(--font-mono)] text-[11px] text-white/40">
              No artists registered yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {artists.map((a) => (
                <li
                  key={a.address}
                  className="flex items-center justify-between border-b border-white/5 pb-2"
                >
                  <span className="font-[family-name:var(--font-mono)] text-[11px] text-white/80">
                    {truncateAddress(a.address, 8, 8)}
                  </span>
                  {isOwner &&
                    (confirmRevoke === a.address ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRevoke(a.address)}
                          disabled={actionState === "pending"}
                          className="font-[family-name:var(--font-mono)] text-[10px] text-red-400 hover:text-red-300 disabled:opacity-40"
                        >
                          {actionState === "pending" ? "Revoking…" : "Confirm revoke"}
                        </button>
                        <button
                          onClick={() => setConfirmRevoke(null)}
                          className="font-[family-name:var(--font-mono)] text-[10px] text-white/40 hover:text-white/70"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRevoke(a.address)}
                        className="font-[family-name:var(--font-mono)] text-[10px] text-white/30 hover:text-red-400 transition-colors"
                      >
                        Revoke
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Section 3 — Register artist */}
        <Section
          title="Register artist"
          help="Ingresá la dirección Stellar (G...) de la wallet del artista. Una vez registrada, esa wallet puede mintear obras en el contrato NFT. Esta acción se ejecuta on-chain y requiere tu firma."
        >
          {!isOwner ? (
            <p className="font-[family-name:var(--font-mono)] text-[11px] text-white/30">
              Connect the owner wallet to register artists.
            </p>
          ) : actionState === "success" ? (
            <div className="flex flex-col gap-2">
              <p className="font-[family-name:var(--font-mono)] text-[11px] text-[#1564FF]">
                Artist registered successfully.
              </p>
              <button
                onClick={reset}
                className="font-[family-name:var(--font-mono)] text-[10px] text-white/40 hover:text-white/70 underline-offset-2 underline"
              >
                Register another
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="G... Stellar wallet address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                disabled={actionState === "pending"}
                className="h-11 border border-white/20 bg-transparent px-4 font-[family-name:var(--font-mono)] text-[12px] text-white placeholder:text-white/20 focus:border-[#1564FF] focus-ring disabled:opacity-40"
              />
              {actionError && (
                <p className="font-[family-name:var(--font-mono)] text-[10px] text-red-400">
                  {actionError}
                </p>
              )}
              <button
                onClick={handleRegister}
                disabled={!newAddress.trim() || actionState === "pending"}
                className="h-11 bg-[#1564FF] px-6 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-widest text-white transition-colors hover:bg-[#4A8AFF] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionState === "pending" ? "Signing… confirm in wallet" : "Register artist"}
              </button>
            </div>
          )}
        </Section>
      </main>
    </div>
  );
}
