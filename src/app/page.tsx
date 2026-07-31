import { getGlobalGraph } from "@/lib/concepts";
import GalaxyClient from "@/components/GalaxyClient";

export default function HomePage() {
  const graph = getGlobalGraph();
  return <GalaxyClient graph={graph} />;
}
