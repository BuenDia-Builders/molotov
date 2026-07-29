"use client";

import { useCallback, useEffect, useState } from "react";
import { Client, networks } from "@molotov/stellar-client/molotov-nft";
import { useWallet } from "@/hooks/use-wallet";
import { uploadImage, uploadMetadata } from "@/lib/ipfs";
import { scValToNative } from "@stellar/stellar-sdk";
import { RPC_URL, isUserRejection, reconcileTransaction } from "@/lib/stellar";
import { MolotovError } from "@/lib/errors";

export type MintState =
  | "idle"
  | "uploading_image"
  | "uploading_metadata"
  | "signing"
  | "confirming"
  | "reconciling"
  | "success"
  | "error";

export type MintErrorKind = "upload" | "sign" | "submit" | null;

export type MintParams = {
  imageFile: File;
  title: string;
  description: string;
  royaltyBps: number;
  royaltyRecipients: Array<{ address: string; shareBps: number }>;
};

export type MintResult = { tokenId: number; txHash: string };

// Derive a stable key from file identity + title so the draft survives a page reload
// but is invalidated when the user picks a different file or changes the title.
function draftKey(params: MintParams): string {
  const f = params.imageFile;
  return `mlv_mint_draft:${f.name}:${f.size}:${f.lastModified}:${params.title}`;
}

function loadDraft(key: string): string | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function saveDraft(key: string, tokenUri: string): void {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, tokenUri);
  } catch {
    /* storage full or unavailable — proceed without idempotency */
  }
}

function clearDraft(key: string): void {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ── Pending-transaction helpers ───────────────────────────── */

const PENDING_PREFIX = "mlv_mint_pending:";

function pendingKey(draftKey: string): string {
  return `${PENDING_PREFIX}${draftKey}`;
}

function savePendingTx(key: string, txHash: string | null, address: string): void {
  try {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(key, JSON.stringify({ txHash, address, sentAt: Date.now() }));
  } catch {
    /* storage full — proceed without idempotency */
  }
}

function loadPendingTx(key: string): { txHash: string | null; address: string; sentAt: number } | null {
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

/** Scans sessionStorage for a pending mint tx belonging to the given wallet. */
function findPendingMintKey(address: string): string | null {
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

export function useMint() {
  const { address, signTransaction } = useWallet();
  const [state, setState] = useState<MintState>("idle");
  const [errorKind, setErrorKind] = useState<MintErrorKind>(null);

  /* Mount-time recovery: reconcile any pending tx from a previous session */
  useEffect(() => {
    if (!address) return;
    const pKey = findPendingMintKey(address);
    if (!pKey) return;
    const entry = loadPendingTx(pKey);
    if (!entry?.txHash) return;

    queueMicrotask(() => setState("reconciling"));
    reconcileTransaction(entry.txHash).then((result) => {
      if (result.status === "SUCCESS") {
        clearPendingTx(pKey);
        setState("success");
      } else if (result.status === "FAILED") {
        clearPendingTx(pKey);
        setErrorKind("submit");
        setState("error");
      }
    });
  }, [address]);

  const reset = useCallback(() => {
    setState("idle");
    setErrorKind(null);
  }, []);

  const mint = useCallback(
    async (params: MintParams): Promise<MintResult> => {
      if (!address) throw new Error("No wallet connected");
      setErrorKind(null);

      const key = draftKey(params);
      let tokenUri = loadDraft(key);

      if (!tokenUri) {
        try {
          setState("uploading_image");
          const { cid: imageCid } = await uploadImage(params.imageFile);

          setState("uploading_metadata");
          const metadata = {
            name: params.title,
            description: params.description,
            image: `ipfs://${imageCid}`,
            external_url: "",
            attributes: [] as unknown[],
          };
          const { cid: metaCid } = await uploadMetadata(metadata);
          tokenUri = `ipfs://${metaCid}`;
          saveDraft(key, tokenUri);
        } catch (err) {
          console.error("[mint] IPFS upload failed", err);
          setErrorKind("upload");
          setState("error");
          throw new MolotovError({
            kind: "upload_failed",
            message: err instanceof Error ? err.message : "IPFS upload failed",
          });
        }
      }

      let capturedHash: string | undefined;

      try {
        const client = new Client({
          contractId: networks.testnet.contractId,
          networkPassphrase: networks.testnet.networkPassphrase,
          rpcUrl: RPC_URL,
          publicKey: address,
          signTransaction: async (xdr: string) => {
            const signed = await signTransaction(xdr, {
              networkPassphrase: networks.testnet.networkPassphrase,
            });
            setState("confirming");
            return signed;
          },
        });

        const tx = await client.mint({
          artist: address,
          recipient: address,
          token_uri: tokenUri,
          royalty_bps: params.royaltyBps,
          recipients: params.royaltyRecipients.map((r) => ({
            address: r.address,
            share_bps: r.shareBps,
          })),
        });

        setState("signing");

        /* Write a pending marker before submission so the page-reload
           recovery can find it even if signAndSend throws. */
        const pKey = pendingKey(key);
        savePendingTx(pKey, null, address);

        const sent = await tx.signAndSend({
          watcher: {
            onSubmitted(response) {
              capturedHash = response?.hash;
              if (capturedHash) savePendingTx(pKey, capturedHash, address);
            },
          },
        });

        const tokenId = Number(sent.result);
        const txHash = sent.sendTransactionResponse?.hash ?? capturedHash ?? "";

        clearDraft(key);
        clearPendingTx(pKey);
        setState("success");
        return { tokenId, txHash };
      } catch (err) {
        /* Re-throw MolotovErrors immediately (they are ours, not SDK errors) */
        if (err instanceof MolotovError) throw err;

        /* Attempt reconciliation when we have a hash — the tx may have
           confirmed despite signAndSend throwing. */
        if (capturedHash) {
          console.warn("[mint] signAndSend threw but tx was submitted — reconciling", capturedHash);
          setState("reconciling");
          const result = await reconcileTransaction(capturedHash);
          if (result.status === "SUCCESS") {
            const tokenId = result.returnValue ? Number(scValToNative(result.returnValue)) : 0;
            clearDraft(key);
            clearPendingTx(pendingKey(key));
            setState("success");
            return { tokenId, txHash: capturedHash };
          }
          if (result.status === "FAILED") {
            clearPendingTx(pendingKey(key));
          }
          /* NOT_FOUND: transaction is still not visible after our retries.
             Leave the pending entry in sessionStorage so mount-time
             recovery can retry later. */
        }

        console.error("[mint] transaction failed", err);
        const rejected = isUserRejection(err);
        setErrorKind(rejected ? "sign" : "submit");
        setState("error");
        throw new MolotovError(
          rejected
            ? { kind: "user_rejected" }
            : {
                kind: "submit_failed",
                message: err instanceof Error ? err.message : "Transaction failed",
              },
        );
      }
    },
    [address, signTransaction],
  );

  return { mint, state, errorKind, reset };
}
