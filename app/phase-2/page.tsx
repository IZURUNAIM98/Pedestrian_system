import type { Metadata } from "next";
import { PhaseTwoDesign } from "@/components/phase-two-design";

export const metadata: Metadata = {
  title: "SmartCross Phase 2",
  description: "Concept design explorer for three-way and four-way SmartCross crossings.",
};

export default function PhaseTwoPage() {
  return <PhaseTwoDesign />;
}
