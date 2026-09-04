"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Client as MarketClient,
  networks as marketNetworks,
} from "@molotov/stellar-client/molotov-marketplace";
import { useWallet } from "@/hooks/use-wallet";
import { RPC_URL, isUserRejection, reconcileTransaction } from "@/lib/stellar";
import { contractErrorKey, type ContractErrorKey } from "@/lib/contract-errors";
import { track } from "@/lib/analytics";

export type BuyState = "idle" | "buying" | "confirming" | "reconciling" | "success" | "error";

/* ── Pending-transaction helpers ───────────────────────────────
   A submitted buy's hash is persisted before the send resolves, so a timeout
   or a reload while waiting for confirmation can reconcile the real outcome
   instead of declaring "nothing was charged" when the purchase actually went
   through — see use-mint.ts, same pattern. Keyed by listing id: a buy is one
   transaction, not a multi-copy loop, so there's no separate draft concept. */

const PENDING_PREFIX = "mlv_buy_pending:";

function pendingKey(listingId: bigint): string {
  return `${PENDING_PREFIX}${listingId.toString()}`;
}

function savePendingTx(key: string, txHash: string, address: string): void {
  try {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(key, JSON.stringify({ txHash, address }));
  } catch {
    /* storage full — proceed without reload recovery */
  }
}

function loadPendingTx(key: string): { txHash: string; address: string } | null {
  try {
    const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPendingTx(key: string): void {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Finds a pending buy tx (one that actually got a hash) for the given wallet. */
function findPendingBuyKey(address: string): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(PENDING_PREFIX)) {
        const entry = loadPendingTx(k);
        if (entry?.address === address && entry.txHash) return k;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function useBuy() {
  const { address, signTransaction } = useWallet();
  const [state, setState] = useState<BuyState>("idle");
  const [errorKey, setErrorKey] = useState<ContractErrorKey | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  /* Mount-time recovery: a buy from a previous session whose hash was
     persisted but never resolved (reload mid-confirmation) is reconciled
     here rather than left as a silent unknown. */
  useEffect(() => {
    if (!address) return;
    const pKey = findPendingBuyKey(address);
    if (!pKey) return;
    const entry = loadPendingTx(pKey);
    if (!entry?.txHash) return;

    queueMicrotask(() => setState("reconciling"));
    reconcileTransaction(entry.txHash)
      .then((result) => {
        if (result.status === "SUCCESS") {
          clearPendingTx(pKey);
          setTxHash(entry.txHash);
          setState("success");
        } else if (result.status === "FAILED") {
          clearPendingTx(pKey);
          setState("idle");
        } else {
          // NOT_FOUND: still unknown — return to idle, keep the marker for later.
          setState("idle");
        }
      })
      .catch(() => setState("idle"));
  }, [address]);

  const reset = useCallback(() => {
    setState("idle");
    setErrorKey(null);
    setTxHash(null);
  }, []);

  const buy = useCallback(
    async ({ listingId, referrer }: { listingId: bigint; referrer?: string | null }) => {
      if (!address) throw new Error("No wallet connected");
      setErrorKey(null);

      // The contract zeroes self-referral anyway; dropping it here just keeps
      // the transaction (and the Sold event) clean.
      const effectiveReferrer = referrer && referrer !== address ? referrer : undefined;
      const pKey = pendingKey(listingId);
      let capturedHash: string | undefined;

      try {
        setState("buying");
        track("purchase_signing", {
          listingId: listingId.toString(),
          referred: Boolean(effectiveReferrer),
        });
        const client = new MarketClient({
          contractId: marketNetworks.testnet.contractId,
          networkPassphrase: marketNetworks.testnet.networkPassphrase,
          rpcUrl: RPC_URL,
          publicKey: address,
          signTransaction: async (xdr: string) => {
            const signed = await signTransaction(xdr, {
              networkPassphrase: marketNetworks.testnet.networkPassphrase,
            });
            setState("confirming");
            return signed;
          },
        });

        const tx = await client.buy({
          buyer: address,
          listing_id: listingId,
          referrer: effectiveReferrer,
        });
        const sent = await tx.signAndSend({
          watcher: {
            // Fires once the tx is submitted (PENDING). Persist the hash so a
            // timeout or an error while waiting for confirmation can reconcile
            // the real outcome instead of assuming the purchase never happened.
            onSubmitted(response) {
              capturedHash = response?.hash;
              if (capturedHash) savePendingTx(pKey, capturedHash, address);
            },
          },
        });
        const hash =
          (sent as { sendTransactionResponse?: { hash?: string } }).sendTransactionResponse?.hash ??
          capturedHash ??
          "";
        clearPendingTx(pKey);
        setTxHash(hash);
        setState("success");
        track("purchase_confirmed", {
          listingId: listingId.toString(),
          referred: Boolean(effectiveReferrer),
        });
        if (effectiveReferrer) {
          track("purchase_via_referral", { listingId: listingId.toString() });
        }
        return { txHash: hash };
      } catch (err) {
        // The dangerous case: signAndSend threw AFTER submitting. If we captured
        // a hash, reconcile the real outcome before declaring failure.
        if (capturedHash) {
          console.warn("[buy] signAndSend threw after submit — reconciling", capturedHash);
          setState("reconciling");
          try {
            const result = await reconcileTransaction(capturedHash);
            if (result.status === "SUCCESS") {
              clearPendingTx(pKey);
              setTxHash(capturedHash);
              setState("success");
              track("purchase_confirmed", {
                listingId: listingId.toString(),
                referred: Boolean(effectiveReferrer),
              });
              return { txHash: capturedHash };
            }
            if (result.status === "FAILED") {
              clearPendingTx(pKey);
            }
            // NOT_FOUND: leave the pending marker for mount-time recovery.
          } catch {
            console.warn("[buy] reconcile threw — falling through to the error path");
          }
        }

        console.error("[buy] transaction failed", err);
        const rejected = isUserRejection(err);
        if (rejected) clearPendingTx(pKey);
        const key = rejected
          ? ("transaction.errors.rejected" as const)
          : contractErrorKey(err, "buy");
        setErrorKey(key);
        setState("error");
        throw err;
      }
    },
    [address, signTransaction],
  );

  return { buy, state, errorKey, txHash, reset };
}
