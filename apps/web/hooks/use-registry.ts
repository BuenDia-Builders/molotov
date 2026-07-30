"use client";

import { useCallback, useState } from "react";
import {
  Contract,
  Address,
  TransactionBuilder,
  Account,
  rpc as StellarRpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/use-wallet";
import { RPC_URL } from "@/lib/stellar";

export const REGISTRY_ID = "CC37LTUPS5WLNBQSVNJJGBMZK4QCUJ76EFGW4RGY7XNVLKFKXCRGU533";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const READ_SOURCE = "GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM";

const server = new StellarRpc.Server(RPC_URL, { allowHttp: false });

interface XdrTransactionResultLike {
  result?(): { switch?(): { name: string } };
}

export function formatResultError(result: unknown): string {
  if (typeof result === "string") return result;
  try {
    const txResult = (result as XdrTransactionResultLike)?.result?.();
    const code = txResult?.switch?.()?.name;
    if (code) return `Transaction failed (${code})`;
  } catch {
    // ignore
  }
  return "Transaction failed";
}

export async function fetchRegistryOwner(): Promise<string | null> {
  try {
    const contract = new Contract(REGISTRY_ID);
    const account = new Account(READ_SOURCE, "0");
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call("get_owner"))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (StellarRpc.Api.isSimulationError(sim)) return null;
    const retval = (sim as StellarRpc.Api.SimulateTransactionSuccessResponse).result?.retval;
    if (!retval) return null;
    const native = scValToNative(retval);
    // get_owner returns Option<Address> — native is the address string or null
    return typeof native === "string" ? native : null;
  } catch {
    return null;
  }
}

async function invokeRegistry(
  fnName: string,
  artistAddress: string,
  publicKey: string,
  signFn: (xdr: string) => Promise<{ signedTxXdr: string }>,
): Promise<string> {
  const contract = new Contract(REGISTRY_ID);
  const account = await server.getAccount(publicKey);
  const tx = new TransactionBuilder(account, {
    fee: "10000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(fnName, Address.fromString(artistAddress).toScVal()),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (StellarRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${(sim as StellarRpc.Api.SimulateTransactionErrorResponse).error || "Contract rejected the operation"}`);
  }

  const assembled = StellarRpc.assembleTransaction(tx, sim).build();
  const { signedTxXdr } = await signFn(assembled.toXDR());

  const sent = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE),
  );
  if (sent.status === "ERROR") throw new Error(`Submit error: ${formatResultError(sent.errorResult)}`);

  // Poll until confirmed
  const hash = sent.hash;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const result = await server.getTransaction(hash);
    if (result.status === StellarRpc.Api.GetTransactionStatus.SUCCESS) return hash;
    if (result.status === StellarRpc.Api.GetTransactionStatus.FAILED)
      throw new Error("Transaction failed on chain");
  }
  throw new Error("Transaction timed out");
}

export type RegistryActionState = "idle" | "pending" | "success" | "error";

export function useRegistry() {
  const { address, signTransaction } = useWallet();
  const [state, setState] = useState<RegistryActionState>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
  }, []);

  const register = useCallback(
    async (artistAddress: string) => {
      if (!address) throw new Error("No wallet connected");
      setState("pending");
      setError(null);
      try {
        await invokeRegistry("register", artistAddress, address, (xdr) =>
          signTransaction(xdr, { networkPassphrase: NETWORK_PASSPHRASE }),
        );
        setState("success");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
        throw err;
      }
    },
    [address, signTransaction],
  );

  const revoke = useCallback(
    async (artistAddress: string) => {
      if (!address) throw new Error("No wallet connected");
      setState("pending");
      setError(null);
      try {
        await invokeRegistry("revoke", artistAddress, address, (xdr) =>
          signTransaction(xdr, { networkPassphrase: NETWORK_PASSPHRASE }),
        );
        setState("success");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
        throw err;
      }
    },
    [address, signTransaction],
  );

  return { register, revoke, state, error, reset };
}
