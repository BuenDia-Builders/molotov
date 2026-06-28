"use client";

import { useCallback, useState } from "react";
import {
  Client as MarketClient,
  networks as marketNetworks,
} from "@molotov/stellar-client/molotov-marketplace";
import { useWallet } from "@/hooks/use-wallet";
import { RPC_URL, isUserRejection } from "@/lib/stellar";

export type CancelState = "idle" | "cancelling" | "success" | "error";

export function useCancel() {
  const { address, signTransaction } = useWallet();
  const [state, setState] = useState<CancelState>("idle");
  const [errorKind, setErrorKind] = useState<"rejected" | "failed" | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setErrorKind(null);
  }, []);

  const cancel = useCallback(
    async ({ listingId }: { listingId: bigint }) => {
      if (!address) throw new Error("No wallet connected");
      setErrorKind(null);

      try {
        setState("cancelling");
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

        const tx = await client.cancel({ seller: address, listing_id: listingId });
        await tx.signAndSend();
        setState("success");
      } catch (err) {
        console.error("[cancel] transaction failed", err);
        setErrorKind(isUserRejection(err) ? "rejected" : "failed");
        setState("error");
        throw err;
      }
    },
    [address, signTransaction],
  );

  return { cancel, state, errorKind, reset };
}
