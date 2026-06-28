import type { Metadata } from "next";
import { CreateClient } from "./create-client";

export const metadata: Metadata = {
  title: "Mint your work — Molotov",
  description:
    "Upload your work to Stellar with immutable royalties written into the contract.",
};

export default function CreatePage() {
  return <CreateClient />;
}
