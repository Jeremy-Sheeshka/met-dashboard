"use client";

import dynamic from "next/dynamic";
import type { GlobalGraph } from "@/lib/concepts";

const Galaxy3D = dynamic(() => import("@/components/Galaxy3D"), { ssr: false });

export default function GalaxyClient({ graph }: { graph: GlobalGraph }) {
  return <Galaxy3D graph={graph} />;
}
