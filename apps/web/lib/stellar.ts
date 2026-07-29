import { rpc, xdr } from "@stellar/stellar-sdk";
import type {
  ISupportedWallet,
  StellarWalletsKit,
  WalletNetwork,
} from "@creit.tech/stellar-wallets-kit";

export type { ISupportedWallet, StellarWalletsKit };

/**
 * Network passphrase. Defaults to TESTNET; set NEXT_PUBLIC_STELLAR_NETWORK=PUBLIC
 * to target mainnet. We use the raw passphrase string so the kit package (which
 * registers web components on import) stays out of the server bundle.
 */
export const IS_TESTNET = process.env.NEXT_PUBLIC_STELLAR_NETWORK !== "PUBLIC";
export const STELLAR_NETWORK_NAME = IS_TESTNET ? "Stellar testnet" : "Stellar mainnet";

export const STELLAR_NETWORK_PASSPHRASE = !IS_TESTNET
  ? "Public Global Stellar Network ; September 2015"
  : "Test SDF Network ; September 2015";

/** WalletConnect Cloud project ID. Absent → the WalletConnect option is not offered. */
export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

/**
 * Creates the multi-provider wallet kit instance supporting Freighter, xBull,
 * Albedo, LOBSTR and Hana. Imported dynamically so it only loads in the browser.
 */
export async function createWalletsKit(): Promise<StellarWalletsKit> {
  const {
    StellarWalletsKit,
    FREIGHTER_ID,
    FreighterModule,
    xBullModule,
    AlbedoModule,
    LobstrModule,
    HanaModule,
  } = await import("@creit.tech/stellar-wallets-kit");

  const modules = [
    new FreighterModule(),
    new xBullModule(),
    new AlbedoModule(),
    new LobstrModule(),
    new HanaModule(),
  ];

  // WalletConnect is how someone signs from a wallet on their phone while browsing
  // on a laptop — and, since there is no native app, it is also how a phone browser
  // reaches a wallet app at all. It needs a project ID from WalletConnect Cloud; if
  // that is not configured we simply omit the module rather than register a broken
  // entry that fails when tapped.
  if (WALLETCONNECT_PROJECT_ID) {
    const { WalletConnectModule, WalletConnectAllowedMethods } =
      await import("@creit.tech/stellar-wallets-kit/modules/walletconnect.module");
    modules.push(
      new WalletConnectModule({
        projectId: WALLETCONNECT_PROJECT_ID,
        name: "Molotov",
        description: "Digital art marketplace where the royalty is enforced by the contract.",
        url:
          typeof window === "undefined" ? "https://molotov-web.vercel.app" : window.location.origin,
        icons: ["https://molotov-web.vercel.app/icon-512.png"],
        method: WalletConnectAllowedMethods.SIGN,
        network: STELLAR_NETWORK_PASSPHRASE as WalletNetwork,
      }),
    );
  }

  return new StellarWalletsKit({
    network: STELLAR_NETWORK_PASSPHRASE as WalletNetwork,
    selectedWalletId: FREIGHTER_ID,
    modules,
  });
}

/** Deployed Molotov NFT contract (Stellar testnet). */
export const NFT_CONTRACT_ID = "CBS6UQE542PLU54SVUIK76EKWUJ3CNPOQ35IB4WXKF3BU6YDIBEC7XWS";

/** Deployed Molotov Marketplace contract (Stellar testnet). */
export const MARKETPLACE_CONTRACT_ID = "CB6T6DOYV2JCD36ZE43ESXNGCL2GBDARCZNRVYQWOXGTZNJBWB72K7DU";

/** Native XLM SAC on Stellar testnet — the only allowed payment currency in v1. */
export const NATIVE_XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

export const RPC_URL = "https://soroban-testnet.stellar.org";

/** Builds a stellar.expert explorer URL for a contract on the active network. */
export function contractExplorerUrl(contractId: string): string {
  const net = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "PUBLIC" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${net}/contract/${contractId}`;
}

/** Builds a stellar.expert explorer URL for a transaction on the active network. */
export function txExplorerUrl(txHash: string): string {
  const net = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "PUBLIC" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${net}/tx/${txHash}`;
}

/** Truncates a Stellar address for display, e.g. GABC…XY12. */
export function truncateAddress(address: string, prefix = 4, suffix = 4): string {
  if (address.length <= prefix + suffix) return address;
  return `${address.slice(0, prefix)}…${address.slice(-suffix)}`;
}

/** Funded testnet account used only as the source for read-only simulations. */
export const READ_SOURCE = "GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM";

export type ReconcileResult =
  | { status: "SUCCESS"; returnValue?: xdr.ScVal }
  | { status: "FAILED" }
  | { status: "NOT_FOUND" };

/**
 * Polls `getTransaction` for a given hash with a simple retry loop.
 * Mirrors the pattern from `use-registry.ts`.
 * Returns the terminal status and, on SUCCESS, the raw return value.
 */
export async function reconcileTransaction(
  txHash: string,
  maxRetries = 20,
  delayMs = 3000,
): Promise<ReconcileResult> {
  const server = new rpc.Server(RPC_URL, { allowHttp: false });
  for (let i = 0; i < maxRetries; i++) {
    const result = await server.getTransaction(txHash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS)
      return { status: "SUCCESS", returnValue: result.returnValue };
    if (result.status === rpc.Api.GetTransactionStatus.FAILED)
      return { status: "FAILED" };
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return { status: "NOT_FOUND" };
}

/** Detects wallet rejection errors across different wallet extensions. */
export function isUserRejection(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("reject") ||
    msg.includes("denied") ||
    msg.includes("declined") ||
    msg.includes("cancel") ||
    msg.includes("user did not")
  );
}
