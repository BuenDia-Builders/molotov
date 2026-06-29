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
  STELLAR_NETWORK_PASSPHRASE,
  type ISupportedWallet,
  type StellarWalletsKit,
} from "@/lib/stellar";

const SELECTED_WALLET_KEY = "molotov:selectedWalletId";

type SignResult = { signedTxXdr: string; signerAddress?: string };

type WalletContextValue = {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
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

  // Lazily create the kit, once, in the browser only.
  const ensureKit = useCallback(() => {
    if (!kitPromiseRef.current) kitPromiseRef.current = createWalletsKit();
    return kitPromiseRef.current;
  }, []);

  // Restore a previous session if the user already authorized a wallet.
  useEffect(() => {
    const savedId = window.localStorage.getItem(SELECTED_WALLET_KEY);
    if (!savedId) return;
    ensureKit()
      .then(async (kit) => {
        kit.setWallet(savedId);
        const { address } = await kit.getAddress({ skipRequestAccess: true });
        setAddress(address);
      })
      .catch(() => window.localStorage.removeItem(SELECTED_WALLET_KEY));
  }, [ensureKit]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const kit = await ensureKit();
      await kit.openModal({
        onWalletSelected: async (option: ISupportedWallet) => {
          kit.setWallet(option.id);
          window.localStorage.setItem(SELECTED_WALLET_KEY, option.id);
          const { address } = await kit.getAddress();
          setAddress(address);
        },
      });
    } finally {
      setIsConnecting(false);
    }
  }, [ensureKit]);

  const connectViaPrivy = useCallback((addr: string, signer: (xdr: string) => Promise<string>) => {
    walletModeRef.current = "privy";
    privySignerRef.current = signer;
    setAddress(addr);
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
        disconnect,
        signTransaction,
        connectViaPrivy,
      }}
    >
      {children}
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
