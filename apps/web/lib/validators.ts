import { z } from "zod";
import { NextResponse } from "next/server";

export const stellarAddress = z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key");

export const tokenId = z.coerce.number().int().positive().max(10_000_000);

export const uploadFile = z.object({
  type: z.string().regex(/^image\/(jpeg|png|webp|gif)$/, "Unsupported format"),
  size: z.number().max(30 * 1024 * 1024, "File exceeds 30 MB"),
});

export function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 422 });
}
