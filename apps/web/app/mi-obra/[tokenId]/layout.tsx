import type { Metadata } from "next";
import { Client, networks } from "@molotov/stellar-client/molotov-nft";
import { ipfsToGateway } from "@/lib/ipfs";

const RPC_URL = "https://soroban-testnet.stellar.org";
const READ_SOURCE = "GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}): Promise<Metadata> {
  try {
    const { tokenId: raw } = await params;
    const tokenId = Number(raw);
    if (!Number.isInteger(tokenId)) return { title: "Obra — Molotov" };

    const client = new Client({
      contractId: networks.testnet.contractId,
      networkPassphrase: networks.testnet.networkPassphrase,
      rpcUrl: RPC_URL,
      publicKey: READ_SOURCE,
    });

    const uri = await client.token_uri({ token_id: tokenId }).then((t) => t.result);
    const meta: { name?: string; image?: string } = await fetch(
      ipfsToGateway(uri),
    ).then((r) => r.json());

    return {
      title: `${meta.name ?? "Obra"} — Molotov`,
      openGraph: meta.image
        ? { images: [{ url: ipfsToGateway(meta.image) }] }
        : undefined,
    };
  } catch {
    return { title: "Obra — Molotov" };
  }
}

export default function TokenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
