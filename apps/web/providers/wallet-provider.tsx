"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createWalletsKit,
  isUserRejection,
  STELLAR_NETWORK_PASSPHRASE,
  type ISupportedWallet,
  type StellarWalletsKit,
} from "@/lib/stellar";
import { WalletSelectModal } from "@/components/wallet-select-modal";
import { track } from "@/lib/analytics";

const SELECTED_WALLET_KEY = "molotov:selectedWalletId";

/** Wallets whose getAddress requires user interaction (web-intent wallets):
 *  connecting works, but auto-restoring on page load would fire a redirect.
 *  Ids match @creit.tech/stellar-wallets-kit module ids. */
const NON_RESTORABLE_WALLET_IDS = ["albedo"];

// The WalletConnect module fires SignClient.init() from its constructor without
// awaiting it, and reports isAvailable() = true immediately. Since we build the kit
// lazily (on the Connect click, not on mount, to avoid opening a relay socket for
// every anonymous visitor), the init network round-trip is usually still in flight
// when the user picks WalletConnect — so getAddress() throws "WalletConnect is not
// running yet" because this.client is null.
//
// This retries getAddress ONLY while that specific error is thrown, up to a short
// deadline. Once the client is ready, getAddress proceeds into the pairing flow
// (QR / deep link) which we await without any timeout of our own — the deadline
// bounds the "waiting for init" phase, never the "waiting for the user to scan" one.
const WC_NOT_READY = "not running yet";
const WC_READY_DEADLINE_MS = 10_000;

// The kit does NOT throw Error instances: its modules run every rejection through
// parseError(), which returns a plain object `{ code, message, ext }`. So reading
// `.message` off an `instanceof Error` check misses it entirely (String(obj) is
// "[object Object]"). Read `.message` from whatever shape we get.
function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message ?? "");
  }
  return String(err);
}

async function getAddressWhenReady(
  kit: StellarWalletsKit,
  opts?: { skipRequestAccess?: boolean },
): Promise<{ address: string }> {
  const deadline = Date.now() + WC_READY_DEADLINE_MS;
  for (;;) {
    try {
      return await kit.getAddress(opts);
    } catch (err) {
      if (!errMessage(err).includes(WC_NOT_READY) || Date.now() > deadline) throw err;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

type SignResult = { signedTxXdr: string; signerAddress?: string };

type WalletContextValue = {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  /** Start building the kit early (on wallet-menu open) so WalletConnect's async
   *  SignClient.init has finished by the time the user picks it. Idempotent. */
  prewarm: () => void;
  disconnect: () => Promise<void>;
  signTransaction: (xdr: string, opts?: { networkPassphrase?: string }) => Promise<SignResult>;
  /** Called by WalletButton after Privy email/Google login resolves a Stellar address. */
  connectViaPrivy: (address: string, signer: (xdr: string) => Promise<string>) => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const kitPromiseRef = useRef<Promise<StellarWalletsKit> | null>(null);
  const walletModeRef = useRef<"swk" | "privy">("swk");
  const privySignerRef = useRef<((xdr: string) => Promise<string>) | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [modalWallets, setModalWallets] = useState<ISupportedWallet[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const walletCallbackRef = useRef<((wallet: ISupportedWallet) => void) | null>(null);

  const ensureKit = useCallback(() => {
    if (!kitPromiseRef.current) kitPromiseRef.current = createWalletsKit();
    return kitPromiseRef.current;
  }, []);

  // Restore a previous session if the user already authorized a wallet.
  useEffect(() => {
    const savedId = window.localStorage.getItem(SELECTED_WALLET_KEY);
    if (!savedId) return;
    // Albedo cannot be restored passively: asking it for the address IS
    // opening albedo.link (a redirect on phones — the app "enters Albedo"
    // before the user touches anything). skipRequestAccess is a Freighter
    // option; Albedo ignores it. Drop the selection and let the user
    // reconnect explicitly when they actually want to sign something.
    if (NON_RESTORABLE_WALLET_IDS.includes(savedId)) {
      window.localStorage.removeItem(SELECTED_WALLET_KEY);
      return;
    }
    ensureKit()
      .then(async (kit) => {
        kit.setWallet(savedId);
        // Same wait as the connect path: a restored WalletConnect session would
        // otherwise be dropped just because init had not finished yet.
        const { address } = await getAddressWhenReady(kit, { skipRequestAccess: true });
        setAddress(address);
      })
      .catch(() => window.localStorage.removeItem(SELECTED_WALLET_KEY));
  }, [ensureKit]);

  const handleWalletSelected = useCallback(
    async (option: ISupportedWallet) => {
      // Hide our selector while the attempt runs (connectingId gates its render):
      // WalletConnect draws its own QR modal in the DOM, and keeping ours on top
      // would cover it. The wallet list stays in state, so on failure the selector
      // reappears with an error to retry — it is not lost.
      setConnectError(null);
      setConnectingId(option.id);
      try {
        const kit = await ensureKit();
        kit.setWallet(option.id);
        const { address } = await getAddressWhenReady(kit);
        // Persist only after a real connection: otherwise a cancelled WalletConnect
        // pairing would be restored on the next load, popping the QR unprompted.
        window.localStorage.setItem(SELECTED_WALLET_KEY, option.id);
        setAddress(address);
        track("wallet_connected", { method: option.id });
        setModalWallets([]); // success: close for good
        walletCallbackRef.current = null;
      } catch (err) {
        // Without this catch the rejection escapes the async click handler as an
        // unhandled promise rejection (the "not running yet" the console showed).
        // Surface a message and let the selector reappear (unless they cancelled).
        if (isUserRejection(err)) {
          setConnectError(null);
        } else if (errMessage(err).includes(WC_NOT_READY)) {
          setConnectError(
            "WalletConnect took too long to start. Check your connection and try again.",
          );
        } else {
          setConnectError("Couldn't connect to that wallet. Try again.");
        }
      } finally {
        setConnectingId(null); // selector shows again (with the error, if any)
        setIsConnecting(false);
      }
    },
    [ensureKit],
  );

  const handleModalClose = useCallback(() => {
    setModalWallets([]);
    setConnectingId(null);
    setConnectError(null);
    walletCallbackRef.current = null;
    setIsConnecting(false);
  }, []);

  // Fire kit creation (and thus WalletConnect's SignClient.init) as early as the
  // user shows intent to connect — when the wallet menu opens — not when they pick
  // WalletConnect. init then runs while they read the wallet list, so by the time
  // they choose it the client is ready and the retry below rarely has to wait. No
  // cost to anonymous visitors: it only fires once someone opens the wallet menu.
  const prewarm = useCallback(() => {
    void ensureKit();
  }, [ensureKit]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const kit = await ensureKit();
      const wallets = await kit.getSupportedWallets();
      setModalWallets(wallets);
    } catch {
      setIsConnecting(false);
    }
  }, [ensureKit]);

  const connectViaPrivy = useCallback((addr: string, signer: (xdr: string) => Promise<string>) => {
    walletModeRef.current = "privy";
    privySignerRef.current = signer;
    setAddress(addr);
    track("wallet_connected", { method: "privy" });
  }, []);

  const disconnect = useCallback(async () => {
    if (walletModeRef.current === "privy") {
      walletModeRef.current = "swk";
      privySignerRef.current = null;
      setAddress(null);
      return;
    }
    const kit = await ensureKit();
    await kit.disconnect();
    window.localStorage.removeItem(SELECTED_WALLET_KEY);
    setAddress(null);
  }, [ensureKit]);

  const signTransaction = useCallback(
    async (xdr: string, opts?: { networkPassphrase?: string }) => {
      if (walletModeRef.current === "privy" && privySignerRef.current) {
        const signedTxXdr = await privySignerRef.current(xdr);
        return { signedTxXdr };
      }
      const kit = await ensureKit();
      return kit.signTransaction(xdr, {
        address: address ?? undefined,
        networkPassphrase: opts?.networkPassphrase ?? STELLAR_NETWORK_PASSPHRASE,
      });
    },
    [ensureKit, address],
  );

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: address !== null,
        isConnecting,
        connect,
        prewarm,
        disconnect,
        signTransaction,
        connectViaPrivy,
      }}
    >
      {children}
      {modalWallets.length > 0 && connectingId === null && (
        <WalletSelectModal
          wallets={modalWallets}
          error={connectError}
          onSelect={handleWalletSelected}
          onClose={handleModalClose}
        />
      )}
    </WalletContext.Provider>
  );
}

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet debe usarse dentro de <WalletProvider>");
  }
  return ctx;
}
