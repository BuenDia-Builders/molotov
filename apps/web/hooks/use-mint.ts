"use client";

import { useCallback, useState } from "react";
import { Client, networks } from "@molotov/stellar-client/molotov-nft";
import { useWallet } from "@/hooks/use-wallet";
import { uploadImage, uploadMetadata } from "@/lib/ipfs";
import { RPC_URL, isUserRejection } from "@/lib/stellar";
import { MolotovError } from "@/lib/errors";

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

export function useMint() {
  const { address, signTransaction } = useWallet();
  const [state, setState] = useState<MintState>("idle");
  const [errorKind, setErrorKind] = useState<MintErrorKind>(null);

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
        const sent = await tx.signAndSend();

        const tokenId = Number(sent.result);
        const txHash =
          (sent as { sendTransactionResponse?: { hash?: string } }).sendTransactionResponse?.hash ??
          "";

        clearDraft(key);
        setState("success");
        return { tokenId, txHash };
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

  return { mint, state, errorKind, reset };
}
