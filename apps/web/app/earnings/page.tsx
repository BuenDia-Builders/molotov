import type { Metadata } from "next";
import { EarningsClient } from "./earnings-client";

export const metadata: Metadata = {
  title: "What you earned — Molotov",
  description:
    "Every primary sale and every resale royalty your work has earned, straight from the chain.",
};

export default function EarningsPage() {
  return <EarningsClient />;
}
