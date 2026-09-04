"use client";

import { useCallback, useState } from "react";
import { networks as nftNetworks } from "@molotov/stellar-client/molotov-nft";
import {
  Client as MarketClient,
  networks as marketNetworks,
} from "@molotov/stellar-client/molotov-marketplace";
import { useWallet } from "@/hooks/use-wallet";
import { NATIVE_XLM_SAC, RPC_URL, isUserRejection } from "@/lib/stellar";
import { xlmToStroops } from "@/lib/stroops";
import { contractErrorKey, type ContractErrorKey } from "@/lib/contract-errors";

export type ListState = "idle" | "listing" | "success" | "error";

export function useList() {
  const { address, signTransaction } = useWallet();
  const [state, setState] = useState<ListState>("idle");
  const [errorKey, setErrorKey] = useState<ContractErrorKey | null>(null);
  const [listingId, setListingId] = useState<bigint | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setErrorKey(null);
    setListingId(null);
  }, []);

  const list = useCallback(
    async ({ tokenId, priceXlm }: { tokenId: number; priceXlm: number }) => {
      if (!address) throw new Error("No wallet connected");
      setErrorKey(null);

      const priceStroops = xlmToStroops(priceXlm);

      const signFn = async (xdr: string) => {
        return signTransaction(xdr, {
          networkPassphrase: nftNetworks.testnet.networkPassphrase,
        });
      };

      try {
        setState("listing");
        const marketClient = new MarketClient({
          contractId: marketNetworks.testnet.contractId,
          networkPassphrase: marketNetworks.testnet.networkPassphrase,
          rpcUrl: RPC_URL,
          publicKey: address,
          signTransaction: signFn,
        });

        const listTx = await marketClient.list({
          seller: address,
          nft: nftNetworks.testnet.contractId,
          token_id: tokenId,
          price: priceStroops,
          currency: NATIVE_XLM_SAC,
          kind: { tag: "FixedPrice", values: undefined as unknown as void },
          editions: 1,
          ends_at: BigInt(0),
          primary_split: undefined,
          referral_bps: 0,
        });
        const sent = await listTx.signAndSend();
        setListingId(sent.result);
        setState("success");
        return { listingId: sent.result };
      } catch (err) {
        console.error("[list] list failed", err);
        const key = isUserRejection(err)
          ? ("transaction.errors.rejected" as const)
          : contractErrorKey(err, "list");
        setErrorKey(key);
        setState("error");
        throw err;
      }
    },
    [address, signTransaction],
  );

  return { list, state, errorKey, listingId, reset };
}
