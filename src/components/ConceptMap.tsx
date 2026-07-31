"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import type { ConceptGraph } from "@/lib/concepts";

// ---------------------------------------------------------------------------
// Palette — constellation theme
// ---------------------------------------------------------------------------

const AMBER = "#f59e0b";
const AMBER_GLOW = "#fbbf24";
const AMBER_LABEL_DARK = "#fde68a";
const AMBER_LABEL_LIGHT = "#92400e";
const INDIGO_DARK = "#818cf8";
const INDIGO_LIGHT = "#6366f1";
const INDIGO_STROKE_DARK = "#c7d2fe";
const INDIGO_STROKE_LIGHT = "#e0e7ff";

// ---------------------------------------------------------------------------

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  type: "concept" | "post";
  label: string;
  fullTitle?: string;
  radius: number;
  docFreq?: number;
  slug?: string;
  course?: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
}

// ---------------------------------------------------------------------------

export default function ConceptMap({ graph }: { graph: ConceptGraph }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 500 });
  const [isDark, setIsDark] = useState(false);

  // Dark mode detection
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 800;
      setDimensions({ w, h: Math.max(400, Math.min(600, w * 0.6)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build sim nodes/links from graph (stable identity)
  const { simNodes, simLinks, lookupMap } = useMemo(() => {
    const maxDocFreq = Math.max(...graph.concepts.map((c) => c.docFreq), 1);
    const maxRT = Math.max(...graph.posts.map((p) => p.readingTime), 1);

    const conceptNodes: SimNode[] = graph.concepts.map((c) => ({
      id: `c-${c.id}`,
      type: "concept" as const,
      label: c.label,
      radius: 14 + (c.docFreq / maxDocFreq) * 18,
      docFreq: c.docFreq,
    }));

    const postNodes: SimNode[] = graph.posts.map((p) => ({
      id: `p-${p.slug}`,
      type: "post" as const,
      label: p.title.length > 40 ? p.title.slice(0, 38) + "…" : p.title,
      fullTitle: p.title,
      radius: 7 + (p.readingTime / maxRT) * 10,
      slug: p.slug,
      course: p.course.toLowerCase(),
    }));

    const nodes = [...conceptNodes, ...postNodes];
    const links: SimLink[] = graph.links.map((l) => ({
      source: `c-${l.concept}`,
      target: `p-${l.postSlug}`,
      weight: l.weight,
    }));

    const lookup = new Map<string, SimNode>();
    for (const n of nodes) lookup.set(n.id, n);

    return { simNodes: nodes, simLinks: links, lookupMap: lookup };
  }, [graph]);

  // D3 render — runs once per dimensions/dark-mode change
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const { w, h } = dimensions;
    svg.selectAll("*").remove();
    if (simNodes.length === 0) return;

    const bg = isDark ? "#0a0a0a" : "#fafafa";
    const g = svg.append("g");

    // Zoom
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.5, 4]).on("zoom", (ev: any) => {
      g.attr("transform", ev.transform);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    svg.call(zoomBehavior as any);

    // Clone nodes for simulation (D3 mutates x/y)
    const nodes: SimNode[] = simNodes.map((n) => {
      const conceptCount = simNodes.filter((x) => x.type === "concept").length;
      if (n.type === "concept") {
        return { ...n, fx: w / 2, fy: h / 2 };
      }
      return {
        ...n,
        x: w / 2 + (Math.random() - 0.5) * w * 0.5,
        y: h / 2 + (Math.random() - 0.5) * h * 0.5,
      };
    });

    // Links
    const link = g
      .append("g")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", isDark ? "rgba(148,163,184,0.2)" : "rgba(100,116,139,0.2)")
      .attr("stroke-width", (d) => 0.5 + d.weight * 0.4);

    // Post groups
    const postG = g
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes.filter((n) => n.type === "post"))
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_e, d) => {
        if (d.slug) window.location.href = `/courses/${d.course}/${d.slug}`;
      })
      .on("mouseenter", (ev, d) => {
        setHoveredId(d.id);
        setTooltip({
          x: (ev as MouseEvent).offsetX,
          y: (ev as MouseEvent).offsetY,
          text: `${d.fullTitle ?? d.label}\n${(d as { readingTime?: number }).readingTime ?? "?"} min read`,
        });
      })
      .on("mouseleave", () => {
        setHoveredId(null);
        setTooltip(null);
      });

    postG
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", isDark ? INDIGO_DARK : INDIGO_LIGHT)
      .attr("stroke", isDark ? INDIGO_STROKE_DARK : INDIGO_STROKE_LIGHT)
      .attr("stroke-width", 1.5);

    postG
      .append("text")
      .text((d) => d.label)
      .attr("dy", (d) => d.radius + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", "8px")
      .attr("fill", isDark ? "#9ca3af" : "#6b7280")
      .style("pointer-events", "none");

    // Concept groups (hubs)
    const conceptG = g
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes.filter((n) => n.type === "concept"))
      .join("g")
      .on("mouseenter", (ev, d) => {
        setHoveredId(d.id);
        setTooltip({
          x: (ev as MouseEvent).offsetX,
          y: (ev as MouseEvent).offsetY,
          text: `${d.label}\n${d.docFreq} posts`,
        });
      })
      .on("mouseleave", () => {
        setHoveredId(null);
        setTooltip(null);
      });

    // Glow ring
    conceptG
      .append("circle")
      .attr("r", (d) => d.radius + 8)
      .attr("fill", "none")
      .attr("stroke", isDark ? AMBER_GLOW : AMBER)
      .attr("stroke-width", 2.5)
      .attr("opacity", 0.3);

    // Hub circle
    conceptG
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", isDark ? AMBER_GLOW : AMBER)
      .attr("stroke", isDark ? "#fcd34d" : "#d97706")
      .attr("stroke-width", 1);

    // Concept label
    conceptG
      .append("text")
      .text((d) => d.label)
      .attr("dy", (d) => -d.radius - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => `${10 + (d.docFreq ?? 1) * 0.5}px`)
      .attr("font-weight", "600")
      .attr("fill", isDark ? AMBER_LABEL_DARK : AMBER_LABEL_LIGHT)
      .style("pointer-events", "none");

    // Simulation
    const sim = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((d) => 90 + (1 - d.weight / 5) * 50)
          .strength((d) => 0.2 + d.weight * 0.04),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force(
        "collide",
        d3.forceCollide<SimNode>().radius((d) => d.radius + 6),
      )
      .alphaDecay(0.018)
      .on("tick", () => {
        link
          .attr("x1", (d) => (d.source as SimNode).x ?? 0)
          .attr("y1", (d) => (d.source as SimNode).y ?? 0)
          .attr("x2", (d) => (d.target as SimNode).x ?? 0)
          .attr("y2", (d) => (d.target as SimNode).y ?? 0);
        postG.attr("transform", (d) => `translate(${d.x},${d.y})`);
        conceptG.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

    return () => {
      sim.stop();
    };
  }, [dimensions, isDark, simNodes, simLinks]);

  // Hover highlighting
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const allGroups = svg.selectAll<SVGGElement, SimNode>("g g");
    const allLines = svg.selectAll<SVGLineElement, SimLink>("line");

    if (hoveredId) {
      const linkedIds = new Set<string>([hoveredId]);
      for (const l of simLinks) {
        const sid = typeof l.source === "object" ? (l.source as SimNode).id : l.source;
        const tid = typeof l.target === "object" ? (l.target as SimNode).id : l.target;
        if (sid === hoveredId) linkedIds.add(tid as string);
        if (tid === hoveredId) linkedIds.add(sid as string);
      }

      allGroups.style("opacity", function (d) {
        return linkedIds.has(d.id) ? "1" : "0.12";
      });

      allLines.style("opacity", function (d) {
        const sid = typeof d.source === "object" ? (d.source as SimNode).id : d.source;
        const tid = typeof d.target === "object" ? (d.target as SimNode).id : d.target;
        return linkedIds.has(sid as string) && linkedIds.has(tid as string) ? "1" : "0.04";
      });
    } else {
      allGroups.style("opacity", null);
      allLines.style("opacity", null);
    }
  }, [hoveredId, simLinks]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full overflow-hidden rounded-2xl">
        <svg
          ref={svgRef}
          width={dimensions.w}
          height={dimensions.h}
          className="w-full block"
        />
      </div>
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 px-3 py-2 text-xs shadow-lg backdrop-blur-sm whitespace-pre-line max-w-[180px]"
          style={{
            left: Math.min(tooltip.x + 12, dimensions.w - 190),
            top: Math.max(tooltip.y - 40, 4),
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
