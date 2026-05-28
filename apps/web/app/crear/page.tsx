import type { Metadata } from "next";
import { CrearClient } from "./crear-client";

export const metadata: Metadata = {
  title: "Mintear obra — Molotov",
  description:
    "Subí tu obra a Stellar con regalías inmutables grabadas en el contrato.",
};

export default function CrearPage() {
  return <CrearClient />;
}
