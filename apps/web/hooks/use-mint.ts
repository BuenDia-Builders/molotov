"use client";

import { useCallback, useEffect, useState } from "react";
import { Client, networks } from "@molotov/stellar-client/molotov-nft";
import { scValToNative } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/use-wallet";
import { uploadImage, uploadMetadata } from "@/lib/ipfs";
import { RPC_URL, isUserRejection, reconcileTransaction } from "@/lib/stellar";
import { contractErrorKey, type ContractErrorKey } from "@/lib/contract-errors";
import { MolotovError } from "@/lib/errors";
import { buildTokenMetadata, type AttributeInput } from "@/lib/metadata";
import { stroopsToXlm } from "@/lib/stroops";

/** Placeholder used only to simulate a mint for a fee estimate — never sent.
 *  A real `token_uri` isn't known until the image/metadata are uploaded to
 *  IPFS, which today only happens once the artist actually submits; this
 *  string is just long enough to be a realistic stand-in for the resource
 *  fee's sizing, without making the artist wait on an upload just to see a
 *  number. */
const FEE_ESTIMATE_TOKEN_URI = "ipfs://bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

/** The contract mints one token per call, one signature each — editions are
 *  sequential mints sharing the same URI, so the cap keeps the signing
 *  session humane. */
export const MAX_EDITIONS = 10;

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
  tags?: string[];
  category?: string | null;
  license?: string | null;
  nsfw?: boolean;
  flashing?: boolean;
  attributes?: AttributeInput[];
  /** 1..MAX_EDITIONS copies sharing one URI — one signature per copy. */
  editions?: number;
};

export type MintResult = { tokenId: number; tokenIds: number[]; txHash: string };

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

/* ── Pending-transaction helpers ───────────────────────────────
   A submitted mint's hash is persisted before the send resolves, so an error
   after submission (or a page reload) can reconcile the real outcome instead of
   assuming failure and double-minting. */

const PENDING_PREFIX = "mlv_mint_pending:";

function pendingKey(draftKey: string): string {
  return `${PENDING_PREFIX}${draftKey}`;
}

function savePendingTx(key: string, txHash: string | null, address: string): void {
  try {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(key, JSON.stringify({ txHash, address }));
  } catch {
    /* storage full — proceed without reload recovery */
  }
}

function loadPendingTx(key: string): { txHash: string | null; address: string } | null {
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

/** Finds a pending mint tx (one that actually got a hash) for the given wallet. */
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
  /** Specific reason a chain-level ("submit") failure happened, decoded from
   *  the contract's own error code where possible — e.g. "your wallet isn't
   *  registered as an artist yet" instead of a flat "something went wrong". */
  const [errorMessageKey, setErrorMessageKey] = useState<ContractErrorKey | null>(null);
  /** Editions progress: how many copies confirmed, out of how many asked. */
  const [progress, setProgress] = useState<{ minted: number; total: number } | null>(null);
  const [feeXlm, setFeeXlm] = useState<string | null>(null);

  /* A quiet, best-effort per-signature network-fee estimate, shown before the
     artist ever signs anything — same idea as useBuy's estimateFee. Simulates
     a mint with the real royalty config but a placeholder token_uri (the real
     one isn't known until the artist actually submits and IPFS upload runs),
     since simulation only needs a same-shaped call, not the final content. */
  const estimateFee = useCallback(
    async (params: {
      royaltyBps: number;
      royaltyRecipients: Array<{ address: string; shareBps: number }>;
    }) => {
      if (!address) return;
      try {
        const client = new Client({
          contractId: networks.testnet.contractId,
          networkPassphrase: networks.testnet.networkPassphrase,
          rpcUrl: RPC_URL,
          publicKey: address,
          signTransaction: async (xdr: string) =>
            signTransaction(xdr, { networkPassphrase: networks.testnet.networkPassphrase }),
        });
        const tx = await client.mint({
          artist: address,
          recipient: address,
          token_uri: FEE_ESTIMATE_TOKEN_URI,
          royalty_bps: params.royaltyBps,
          recipients: params.royaltyRecipients.map((r) => ({
            address: r.address,
            share_bps: r.shareBps,
          })),
        });
        setFeeXlm(tx.built?.fee ? stroopsToXlm(tx.built.fee) : null);
      } catch {
        setFeeXlm(null);
      }
    },
    [address, signTransaction],
  );

  /* Mount-time recovery: a mint from a previous session whose hash was persisted
     but never resolved (reload mid-confirmation) is reconciled here rather than
     left as a silent unknown. */
  useEffect(() => {
    if (!address) return;
    const pKey = findPendingMintKey(address);
    if (!pKey) return;
    const entry = loadPendingTx(pKey);
    if (!entry?.txHash) return;

    // Defer out of the effect body so the synchronous setState doesn't cascade.
    queueMicrotask(() => setState("reconciling"));
    reconcileTransaction(entry.txHash)
      .then((result) => {
        if (result.status === "SUCCESS") {
          clearPendingTx(pKey);
          setState("success");
        } else if (result.status === "FAILED") {
          clearPendingTx(pKey);
          setErrorKind("submit");
          setState("error");
        } else {
          // NOT_FOUND: still unknown — return to idle, keep the marker for later.
          setState("idle");
        }
      })
      .catch(() => setState("idle"));
  }, [address]);

  const reset = useCallback(() => {
    setState("idle");
    setErrorKind(null);
    setErrorMessageKey(null);
    setProgress(null);
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
          const metadata = buildTokenMetadata({
            title: params.title,
            description: params.description,
            imageCid,
            tags: params.tags,
            category: params.category,
            license: params.license,
            nsfw: params.nsfw,
            flashing: params.flashing,
            attributes: params.attributes,
          });
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

      const pKey = pendingKey(key);
      let capturedHash: string | undefined;
      const tokenIds: number[] = [];

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

        const editions = Math.min(Math.max(params.editions ?? 1, 1), MAX_EDITIONS);
        let lastHash = "";

        // One mint call — one signature — per copy, all sharing the same URI.
        // A failure mid-run leaves every already-minted copy fully valid;
        // `progress` tells the form how many landed so the artist can retry
        // just the remainder.
        for (let copy = 0; copy < editions; copy++) {
          setProgress(editions > 1 ? { minted: tokenIds.length, total: editions } : null);
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

          // Reset per copy so the catch only reconciles the hash THIS copy sent.
          capturedHash = undefined;

          const sent = await tx.signAndSend({
            watcher: {
              // Fires once the tx is submitted (PENDING). Persist the hash so an
              // error while waiting for confirmation, or a reload, can reconcile.
              onSubmitted(response) {
                capturedHash = response?.hash;
                if (capturedHash) savePendingTx(pKey, capturedHash, address);
              },
            },
          });

          tokenIds.push(Number(sent.result));
          lastHash = sent.sendTransactionResponse?.hash ?? capturedHash ?? "";
          setProgress(editions > 1 ? { minted: tokenIds.length, total: editions } : null);
        }

        clearDraft(key);
        clearPendingTx(pKey);
        setState("success");
        return { tokenId: tokenIds[0], tokenIds, txHash: lastHash };
      } catch (err) {
        // Our own errors (e.g. upload) are not SDK failures — rethrow as-is.
        if (err instanceof MolotovError) throw err;

        // The dangerous case: signAndSend threw AFTER submitting. If we captured a
        // hash, reconcile the real outcome before declaring failure.
        if (capturedHash) {
          console.warn("[mint] signAndSend threw after submit — reconciling", capturedHash);
          setState("reconciling");
          try {
            const result = await reconcileTransaction(capturedHash);
            if (result.status === "SUCCESS") {
              const tokenId = result.returnValue ? Number(scValToNative(result.returnValue)) : 0;
              clearDraft(key);
              clearPendingTx(pKey);
              setState("success");
              return { tokenId, tokenIds: [...tokenIds, tokenId], txHash: capturedHash };
            }
            if (result.status === "FAILED") {
              clearPendingTx(pKey);
            }
            // NOT_FOUND: leave the pending marker for mount-time recovery.
          } catch {
            console.warn("[mint] reconcile threw — falling through to the error path");
          }
        }

        console.error("[mint] transaction failed", err);
        const rejected = isUserRejection(err);
        if (rejected) clearPendingTx(pKey);
        setErrorKind(rejected ? "sign" : "submit");
        // Decode the contract's own error code where the failure reached the
        // chain at all (e.g. ArtistNotRegistered) — falls back to the generic
        // "transaction.errors.failed" key when it can't be identified.
        if (!rejected) setErrorMessageKey(contractErrorKey(err));
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

  return { mint, state, errorKind, errorMessageKey, progress, feeXlm, estimateFee, reset };
}
