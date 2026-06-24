import { PinataSDK } from "pinata";

// IPFS uploads run server-side so the Pinata JWT never reaches the client.
// Uses the modern v3 SDK (pinata.upload.public.file). See docs/pinata-setup.md.
export const runtime = "nodejs";

let pinata: PinataSDK | null = null;

function getPinata(): PinataSDK {
  if (!pinata) {
    pinata = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT as string,
      // Only used by retrieval helpers; uploads work without a dedicated one.
      pinataGateway: process.env.PINATA_GATEWAY,
    });
  }
  return pinata;
}

export async function POST(request: Request) {
  if (!process.env.PINATA_JWT) {
    return Response.json(
      { error: "IPFS is not configured on the server." },
      { status: 500 },
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    /* falls through to the 400 below */
  }
  if (!file) {
    return Response.json({ error: "Missing file." }, { status: 400 });
  }

  try {
    const upload = await getPinata().upload.public.file(file);
    const cid = upload.cid;
    if (!cid) throw new Error("Pinata did not return a CID");
    return Response.json({
      cid,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
    });
  } catch (err) {
    console.error("[ipfs/upload]", err);
    return Response.json(
      { error: "Could not upload file to IPFS." },
      { status: 502 },
    );
  }
}
