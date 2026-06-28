"use client";

import { useCallback, useState } from "react";
import { Client as NftClient, networks as nftNetworks } from "@molotov/stellar-client/molotov-nft";
import { Client as MarketClient, networks as marketNetworks } from "@molotov/stellar-client/molotov-marketplace";
import { useWallet } from "@/hooks/use-wallet";
import { MARKETPLACE_CONTRACT_ID, NATIVE_XLM_SAC, RPC_URL } from "@/lib/stellar";

export type ListState = "idle" | "approving" | "listing" | "success" | "error";
export type ListErrorKind = "approve" | "list" | null;

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

export function useList() {
  const { address, signTransaction } = useWallet();
  const [state, setState] = useState<ListState>("idle");
  const [errorKind, setErrorKind] = useState<ListErrorKind>(null);
  const [listingId, setListingId] = useState<bigint | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setErrorKind(null);
    setListingId(null);
  }, []);

  const list = useCallback(
    async ({ tokenId, priceXlm }: { tokenId: number; priceXlm: number }) => {
      if (!address) throw new Error("No wallet connected");
      setErrorKind(null);

      const priceStraops = BigInt(Math.round(priceXlm * 10_000_000));

      const signFn = async (xdr: string) => {
        return signTransaction(xdr, {
          networkPassphrase: nftNetworks.testnet.networkPassphrase,
        });
      };

      // Get current ledger to set approve TTL
      const rpcResp = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestLedger", params: {} }),
      }).then((r) => r.json());
      const currentLedger: number = rpcResp.result?.sequence ?? 0;

      // Step 1: approve the marketplace to transfer this token
      try {
        setState("approving");
        const nftClient = new NftClient({
          contractId: nftNetworks.testnet.contractId,
          networkPassphrase: nftNetworks.testnet.networkPassphrase,
          rpcUrl: RPC_URL,
          publicKey: address,
          signTransaction: signFn,
        });

        const approveTx = await nftClient.approve({
          approver: address,
          approved: MARKETPLACE_CONTRACT_ID,
          token_id: tokenId,
          live_until_ledger: currentLedger + 500,
        });
        await approveTx.signAndSend();
      } catch (err) {
        console.error("[list] approve failed", err);
        setErrorKind(isUserRejection(err) ? "approve" : "approve");
        setState("error");
        throw err;
      }

      // Step 2: create the fixed-price listing (secondary — royalties always enforced)
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
          price: priceStraops,
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
        setErrorKind("list");
        setState("error");
        throw err;
      }
    },
    [address, signTransaction],
  );

  return { list, state, errorKind, listingId, reset };
}
