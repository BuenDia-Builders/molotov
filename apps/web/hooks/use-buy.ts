"use client";

import { useCallback, useState } from "react";
import {
  Client as MarketClient,
  networks as marketNetworks,
} from "@molotov/stellar-client/molotov-marketplace";
import { useWallet } from "@/hooks/use-wallet";
import { RPC_URL, isUserRejection } from "@/lib/stellar";
import { contractErrorKey, type ContractErrorKey } from "@/lib/contract-errors";

export type BuyState = "idle" | "buying" | "success" | "error";

export function useBuy() {
  const { address, signTransaction } = useWallet();
  const [state, setState] = useState<BuyState>("idle");
  const [errorKey, setErrorKey] = useState<ContractErrorKey | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setErrorKey(null);
    setTxHash(null);
  }, []);

  const buy = useCallback(
    async ({ listingId }: { listingId: bigint }) => {
      if (!address) throw new Error("No wallet connected");
      setErrorKey(null);

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
          (sent as { sendTransactionResponse?: { hash?: string } }).sendTransactionResponse?.hash ??
          "";
        setTxHash(hash);
        setState("success");
        return { txHash: hash };
      } catch (err) {
        console.error("[buy] transaction failed", err);
        const key = isUserRejection(err)
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
