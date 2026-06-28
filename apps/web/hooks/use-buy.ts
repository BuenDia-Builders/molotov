"use client";

import { useCallback, useState } from "react";
import { Client as MarketClient, networks as marketNetworks } from "@molotov/stellar-client/molotov-marketplace";
import { useWallet } from "@/hooks/use-wallet";
import { RPC_URL } from "@/lib/stellar";

export type BuyState = "idle" | "buying" | "success" | "error";

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

export function useBuy() {
  const { address, signTransaction } = useWallet();
  const [state, setState] = useState<BuyState>("idle");
  const [errorKind, setErrorKind] = useState<"rejected" | "failed" | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setErrorKind(null);
    setTxHash(null);
  }, []);

  const buy = useCallback(
    async ({ listingId }: { listingId: bigint }) => {
      if (!address) throw new Error("No wallet connected");
      setErrorKind(null);

      try {
        setState("buying");
        const client = new MarketClient({
          contractId: marketNetworks.testnet.contractId,
          networkPassphrase: marketNetworks.testnet.networkPassphrase,
          rpcUrl: RPC_URL,
          publicKey: address,
          signTransaction: async (xdr: string) => {
            return signTransaction(xdr, {
              networkPassphrase: marketNetworks.testnet.networkPassphrase,
            });
          },
        });

        const tx = await client.buy({
          buyer: address,
          listing_id: listingId,
          referrer: undefined,
        });
        const sent = await tx.signAndSend();
        const hash =
          (sent as { sendTransactionResponse?: { hash?: string } })
            .sendTransactionResponse?.hash ?? "";
        setTxHash(hash);
        setState("success");
        return { txHash: hash };
      } catch (err) {
        console.error("[buy] transaction failed", err);
        setErrorKind(isUserRejection(err) ? "rejected" : "failed");
        setState("error");
        throw err;
      }
    },
    [address, signTransaction],
  );

  return { buy, state, errorKind, txHash, reset };
}
