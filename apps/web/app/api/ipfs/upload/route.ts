import { NextRequest } from "next/server";
import { PinataSDK } from "pinata";
import { rateLimit } from "@/lib/rate-limit";
import { uploadFile, validationError } from "@/lib/validators";

// IPFS uploads run server-side so the Pinata JWT never reaches the client.
// Uses the modern v3 SDK (pinata.upload.public.file). See docs/pinata-setup.md.
export const runtime = "nodejs";

const checkLimit = rateLimit({ windowMs: 60_000, max: 10 });

let pinata: PinataSDK | null = null;

function getPinata(): PinataSDK {
  if (!pinata) {
    pinata = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT as string,
      pinataGateway: process.env.PINATA_GATEWAY,
    });
  }
  return pinata;
}

export async function POST(request: NextRequest) {
  const limited = checkLimit(request);
  if (limited) return limited;

  if (!process.env.PINATA_JWT) {
    return Response.json({ error: "IPFS is not configured on the server." }, { status: 500 });
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

  const fileValidation = uploadFile.safeParse({ type: file.type, size: file.size });
  if (!fileValidation.success) return validationError(fileValidation.error.issues[0].message);

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
    return Response.json({ error: "Could not upload file to IPFS." }, { status: 502 });
  }
}
