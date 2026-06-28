"use client";

import { useCallback, useState } from "react";
import { Client, networks } from "@molotov/stellar-client/molotov-nft";
import { useWallet } from "@/hooks/use-wallet";
import { uploadImage, uploadMetadata } from "@/lib/ipfs";
import { RPC_URL } from "@/lib/stellar";

export type MintState =
  | "idle"
  | "uploading_image"
  | "uploading_metadata"
  | "signing"
  | "confirming"
  | "success"
  | "error";

/** Where a failure happened — drives the editorial error message + retry CTA. */
export type MintErrorKind = "upload" | "sign" | "submit" | null;

export type MintParams = {
  imageFile: File;
  title: string;
  description: string;
  royaltyBps: number; // 100..1500
  royaltyRecipients: Array<{ address: string; shareBps: number }>;
};

export type MintResult = { tokenId: number; txHash: string };

function isUserRejection(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("reject") ||
    msg.includes("denied") ||
    msg.includes("declined") ||
    msg.includes("cancel") ||
    msg.includes("user did not")
  );
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
      if (!address) throw new Error("No hay wallet conectada");
      setErrorKind(null);

      // 1 + 2 — IPFS uploads.
      let tokenUri: string;
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
      } catch (err) {
        console.error("[mint] IPFS upload failed", err);
        setErrorKind("upload");
        setState("error");
        throw err;
      }

      // 3..6 — build, sign and submit the Soroban transaction via the bindings.
      try {
        const client = new Client({
          contractId: networks.testnet.contractId,
          networkPassphrase: networks.testnet.networkPassphrase,
          rpcUrl: RPC_URL,
          publicKey: address,
          signTransaction: async (xdr: string) => {
            // The wallet popup is open now; once it returns we're waiting on chain.
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
          (sent as { sendTransactionResponse?: { hash?: string } })
            .sendTransactionResponse?.hash ?? "";

        setState("success");
        return { tokenId, txHash };
      } catch (err) {
        console.error("[mint] transaction failed", err);
        setErrorKind(isUserRejection(err) ? "sign" : "submit");
        setState("error");
        throw err;
      }
    },
    [address, signTransaction],
  );

  return { mint, state, errorKind, reset };
}
