"use client";

import { useCallback, useState } from "react";
import { Client, networks } from "@molotov/stellar-client/molotov-nft";
import { useWallet } from "@/hooks/use-wallet";
import { uploadImage, uploadMetadata } from "@/lib/ipfs";
import { RPC_URL, isUserRejection } from "@/lib/stellar";
import { MolotovError } from "@/lib/errors";
import { buildTokenMetadata, type AttributeInput } from "@/lib/metadata";

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

export function useMint() {
  const { address, signTransaction } = useWallet();
  const [state, setState] = useState<MintState>("idle");
  const [errorKind, setErrorKind] = useState<MintErrorKind>(null);
  /** Editions progress: how many copies confirmed, out of how many asked. */
  const [progress, setProgress] = useState<{ minted: number; total: number } | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setErrorKind(null);
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
        const tokenIds: number[] = [];
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
          const sent = await tx.signAndSend();

          tokenIds.push(Number(sent.result));
          lastHash =
            (sent as { sendTransactionResponse?: { hash?: string } }).sendTransactionResponse
              ?.hash ?? "";
          setProgress(editions > 1 ? { minted: tokenIds.length, total: editions } : null);
        }

        clearDraft(key);
        setState("success");
        return { tokenId: tokenIds[0], tokenIds, txHash: lastHash };
      } catch (err) {
        if (err instanceof MolotovError) throw err;
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

  return { mint, state, errorKind, progress, reset };
}
