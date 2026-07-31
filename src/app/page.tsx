import { getGlobalGraph } from "@/lib/concepts";
import Galaxy from "@/components/Galaxy";

export default function HomePage() {
  const graph = getGlobalGraph();

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <Galaxy graph={graph} />
    </div>
  );
}
