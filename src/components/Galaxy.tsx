"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import type { GlobalGraph, GlobalNode } from "@/lib/concepts";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const COURSE_ARC_RADIUS = 0.35; // fraction of min(w,h) for course arc

// Course positions on a gentle arc
const COURSE_POSITIONS: Record<string, [number, number]> = {
  ETEC500: [0.15, 0.18],
  ETEC510: [0.30, 0.10],
  ETEC511: [0.50, 0.08],
  ETEC512: [0.70, 0.10],
  ETEC522: [0.85, 0.18],
  ETEC531: [0.85, 0.42],
  ETEC542: [0.70, 0.50],
  ETEC544: [0.50, 0.52],
};

// Node colors by type
const COLORS = {
  course: { fill: "#7c3aed", stroke: "#a78bfa", label: "#c4b5fd", darkFill: "#8b5cf6", darkStroke: "#c4b5fd", darkLabel: "#ddd6fe" },
  post: { fill: "#475569", stroke: "#94a3b8", label: "#64748b", darkFill: "#94a3b8", darkStroke: "#cbd5e1", darkLabel: "#e2e8f0" },
  concept: { fill: "#d97706", stroke: "#f59e0b", label: "#92400e", darkFill: "#f59e0b", darkStroke: "#fbbf24", darkLabel: "#fde68a" },
  interactive: { ring: "#f59e0b", darkRing: "#fbbf24" },
};

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function DetailPanel({ node, onClose }: { node: GlobalNode; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 lg:w-96 bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-40 overflow-y-auto animate-slide-in">
      <div className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 px-5 py-3 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {node.course ?? "Post"}
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">&times;</button>
      </div>
      <div className="p-5">
        <h2 className="text-lg font-bold leading-snug mb-2">{node.title}</h2>
        {node.date && (
          <p className="text-xs text-gray-400 mb-3">
            {new Date(node.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · {node.readingTime} min read
          </p>
        )}
        {node.interactive && (
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 text-xs font-medium mb-3">
            Interactive
          </span>
        )}
        {node.excerpt && (
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{node.excerpt}</p>
        )}
        <div className="space-y-2">
          {node.slug && node.course && (
            <a
              href={`/courses/${node.course.toLowerCase()}/${node.slug}`}
              className="block w-full text-center rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              Open full post →
            </a>
          )}
          {node.url && (
            <a
              href={node.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              View on blog ↗
            </a>
          )}
          <button
            onClick={() => {
              const url = `/courses/${node.course?.toLowerCase()}/${node.slug}`;
              navigator.clipboard.writeText(window.location.origin + url).catch(() => {});
            }}
            className="block w-full text-center rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Copy link
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Galaxy component
// ---------------------------------------------------------------------------

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  type: "course" | "post" | "concept";
  label: string;
  radius: number;
  course?: string;
  interactive?: boolean;
  docFreq?: number;
  postCount?: number;
  anchorX?: number;
  anchorY?: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
  linkType: "membership" | "concept";
}

export default function Galaxy({ graph }: { graph: GlobalGraph }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<GlobalNode | null>(null);
  const [focusedCourse, setFocusedCourse] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [dims, setDims] = useState({ w: 900, h: 700 });
  const [isDark, setIsDark] = useState(false);

  // Dark mode
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
      const w = entries[0]?.contentRect.width ?? 900;
      setDims({ w, h: Math.max(500, w * 0.7) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build sim data from graph
  const { simNodes, simLinks } = useMemo(() => {
    const maxRT = Math.max(...graph.nodes.filter((n) => n.type === "post").map((n) => n.readingTime ?? 1), 1);

    const sn: SimNode[] = graph.nodes.map((n) => {
      const pos = n.type === "course" ? COURSE_POSITIONS[n.label] ?? [0.5, 0.1] : undefined;
      return {
        id: n.id,
        type: n.type,
        label: n.label,
        radius: n.type === "course" ? 16
          : n.type === "concept" ? 6 + (n.docFreq ?? 1) * 1.5
          : 5 + ((n.readingTime ?? 1) / maxRT) * 10,
        course: n.course,
        interactive: n.interactive,
        docFreq: n.docFreq,
        postCount: n.postCount,
        anchorX: pos ? pos[0] : undefined,
        anchorY: pos ? pos[1] : undefined,
      };
    });

    const sl: SimLink[] = graph.links.map((l) => ({
      source: l.source,
      target: l.target,
      weight: l.weight,
      linkType: l.type,
    }));

    return { simNodes: sn, simLinks: sl };
  }, [graph]);

  // D3 render
  const isDarkRef = useRef(isDark);
  // Keep ref in sync
  useEffect(() => { isDarkRef.current = isDark; }, [isDark]);
  isDarkRef.current = isDark;

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const { w, h } = dims;
    svg.selectAll("*").remove();
    if (simNodes.length === 0) return;

    const g = svg.append("g");

    // Zoom
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 6]).on("zoom", (ev: any) => {
      g.attr("transform", ev.transform);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    svg.call(zoom as any);

    // Clone nodes for simulation
    const nodes: SimNode[] = simNodes.map((n) => {
      const ax = n.anchorX !== undefined ? n.anchorX * w : w / 2 + (Math.random() - 0.5) * w * 0.6;
      const ay = n.anchorY !== undefined ? n.anchorY * h : h / 2 + (Math.random() - 0.5) * h * 0.6;
      return { ...n, x: ax, y: ay, fx: n.type === "course" ? ax : undefined, fy: n.type === "course" ? ay : undefined };
    });

    const dark = isDarkRef.current;
    function c(type: "course" | "post" | "concept", prop: "fill" | "stroke" | "label"): string {
      const entry = COLORS[type];
      const key = dark ? `dark${prop.charAt(0).toUpperCase()}${prop.slice(1)}` : prop;
      return (entry as Record<string, string>)[key] ?? entry[prop];
    }

    // Links
    const link = g.append("g").selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks).join("line")
      .attr("stroke", dark ? "rgba(100,116,139,0.12)" : "rgba(148,163,184,0.12)")
      .attr("stroke-width", (d) => 0.3 + d.weight * 0.3);

    // Node groups
    const nodeG = g.append("g").selectAll<SVGGElement, SimNode>("g")
      .data(nodes).join("g")
      .attr("cursor", "pointer")
      .on("mouseenter", (ev, d) => {
        setHoveredId(d.id);
        const t = d.type === "concept" ? `${d.label}\n${d.docFreq ?? "?"} posts`
          : d.type === "course" ? `${d.label}\n${d.postCount ?? "?"} posts`
          : `${d.label}`;
        setTooltip({ x: (ev as MouseEvent).offsetX, y: (ev as MouseEvent).offsetY, text: t });
      })
      .on("mouseleave", () => { setHoveredId(null); setTooltip(null); })
      .on("click", (_ev, d) => {
        if (d.type === "post") {
          const gnode = graph.nodes.find((n) => n.id === d.id);
          if (gnode) setSelectedPost(gnode);
        } else if (d.type === "course") {
          setFocusedCourse(focusedCourse === d.label ? null : d.label);
        }
      });

    // Interactive ring for interactive posts
    nodeG.filter((d) => d.type === "post" && d.interactive === true)
      .append("circle")
      .attr("r", (d) => d.radius + 3)
      .attr("fill", "none")
      .attr("stroke", dark ? COLORS.interactive.darkRing : COLORS.interactive.ring)
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "3,2")
      .attr("opacity", 0.6);

    // Main circles
    nodeG.append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => c(d.type, "fill"))
      .attr("stroke", (d) => c(d.type, "stroke"))
      .attr("stroke-width", (d) => d.type === "course" ? 2 : 0.8);

    // Labels for courses and concepts
    nodeG.filter((d) => d.type === "course" || d.type === "concept")
      .append("text")
      .text((d) => d.label)
      .attr("dy", (d) => -d.radius - 6)
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => d.type === "course" ? "13px" : "9px")
      .attr("font-weight", d => d.type === "course" ? "700" : "500")
      .attr("fill", (d) => c(d.type, "label"))
      .style("pointer-events", "none");

    // Post labels (small, truncated)
    nodeG.filter((d) => d.type === "post")
      .append("text")
      .text((d) => d.label.length > 25 ? d.label.slice(0, 23) + "…" : d.label)
      .attr("dy", (d) => d.radius + 11)
      .attr("text-anchor", "middle")
      .attr("font-size", "7px")
      .attr("fill", dark ? "#94a3b8" : "#64748b")
      .style("pointer-events", "none");

    // Course hulls
    const courseIds = [...new Set(nodes.filter((n) => n.type === "post").map((n) => n.course).filter(Boolean))];
    for (const cid of courseIds) {
      const cNode = nodes.find((n) => n.type === "course" && n.label === cid);
      if (!cNode?.x || !cNode?.y) continue;
      g.append("circle")
        .attr("cx", cNode.x).attr("cy", cNode.y)
        .attr("r", 80)
        .attr("fill", "none")
        .attr("stroke", dark ? "rgba(139,92,246,0.08)" : "rgba(124,58,237,0.06)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,8")
        .lower();
    }

    // Simulation
    const sim = d3.forceSimulation<SimNode>(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id)
        .distance((d) => d.linkType === "membership" ? 55 : 70 + (1 - d.weight / 6) * 40)
        .strength((d) => d.linkType === "membership" ? 0.6 : 0.15 + d.weight * 0.03))
      .force("charge", d3.forceManyBody().strength(-180))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collide", d3.forceCollide<SimNode>().radius((d) => d.radius + 3))
      .alphaDecay(0.015)
      .on("tick", () => {
        link
          .attr("x1", (d) => (d.source as SimNode).x ?? 0)
          .attr("y1", (d) => (d.source as SimNode).y ?? 0)
          .attr("x2", (d) => (d.target as SimNode).x ?? 0)
          .attr("y2", (d) => (d.target as SimNode).y ?? 0);
        nodeG.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

    return () => { sim.stop(); };
  }, [dims, simNodes, simLinks]);

  // Hover highlighting
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const allG = svg.selectAll<SVGGElement, SimNode>("g g");
    const allLines = svg.selectAll<SVGLineElement, SimLink>("line");

    if (hoveredId || focusedCourse) {
      const active = new Set<string>();
      if (hoveredId) active.add(hoveredId);
      if (focusedCourse) active.add(`course-${focusedCourse}`);

      // Find linked nodes
      for (const l of simLinks) {
        const sid = typeof l.source === "object" ? (l.source as SimNode).id : l.source;
        const tid = typeof l.target === "object" ? (l.target as SimNode).id : l.target;
        if (active.has(sid as string) || (focusedCourse && simNodes.find((n) => n.id === tid && n.course === focusedCourse))) {
          active.add(tid as string);
        }
        if (active.has(tid as string) || (focusedCourse && simNodes.find((n) => n.id === sid && n.course === focusedCourse))) {
          active.add(sid as string);
        }
      }
      if (focusedCourse) {
        for (const n of simNodes) if (n.course === focusedCourse) active.add(n.id);
      }

      allG.style("opacity", function (d) { return active.has(d.id) ? "1" : "0.08"; });
      allLines.style("opacity", function (d) {
        const sid = typeof d.source === "object" ? (d.source as SimNode).id : d.source;
        const tid = typeof d.target === "object" ? (d.target as SimNode).id : d.target;
        return active.has(sid as string) && active.has(tid as string) ? "0.6" : "0.02";
      });
    } else {
      allG.style("opacity", null);
      allLines.style("opacity", null);
    }
  }, [hoveredId, focusedCourse, simLinks, simNodes]);

  // Keyboard: Escape closes panel
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setSelectedPost(null); setFocusedCourse(null); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: `${dims.h}px` }}>
      <svg ref={svgRef} width={dims.w} height={dims.h} className="w-full block" />

      {/* Wordmark */}
      <div className="absolute top-4 left-6 pointer-events-none">
        <span className="text-2xl" style={{ fontFamily: "'Homemade Apple', cursive", color: isDark ? "#c4b5fd" : "#7c3aed", opacity: 0.7 }}>
          MET
        </span>
      </div>

      {/* Legend chips */}
      <div className="absolute top-4 right-6 flex flex-wrap gap-2 max-w-[60%] justify-end">
        {[...new Set(graph.nodes.filter((n) => n.type === "course").map((n) => n.label))].map((cid) => (
          <button
            key={cid}
            onClick={() => setFocusedCourse(focusedCourse === cid ? null : cid)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              focusedCourse === cid
                ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 ring-2 ring-violet-400"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {cid}
          </button>
        ))}
      </div>

      {/* Detail panel */}
      {selectedPost && (
        <DetailPanel node={selectedPost} onClose={() => setSelectedPost(null)} />
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 px-3 py-2 text-xs shadow-lg backdrop-blur-sm whitespace-pre-line max-w-[180px]"
          style={{ left: Math.min(tooltip.x + 12, dims.w - 190), top: Math.max(tooltip.y - 40, 4) }}
        >
          {tooltip.text}
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in { animation: slide-in 0.25s ease-out; }
      `}</style>
    </div>
  );
}
