"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { GlobalGraph, GlobalNode } from "@/lib/concepts";

// ---------------------------------------------------------------------------
// Palette — one earthy hue per course (a full wheel; reads on light + dark).
// Posts/leaves inherit a lightened tint of their course color, so a course
// reads as one colored canopy. NO red-as-default; interactive = site accent.
// ---------------------------------------------------------------------------
const COURSE_COLORS: Record<string, string> = {
  ETEC500: "#2f8f6b", ETEC510: "#2b8fb0", ETEC511: "#4f6fd1", ETEC512: "#8267d6",
  ETEC522: "#c2557a", ETEC531: "#d98a2b", ETEC542: "#c2683f", ETEC544: "#7fae3f",
};
const BARK = "#6b5d4f";
const BARK_DARK = "#8a7a68";
const ROOT = "#4a3f33";
const ROOT_DARK = "#6b5d4f";
const INTERACTIVE = "#3b82f6"; // site --ring accent (the "fruit" halo)

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function tint(hex: string, mixHex: string, amt: number) {
  return new THREE.Color(hex).lerp(new THREE.Color(mixHex), amt);
}

// Tapered tube along a curve (circular cross-section => Frenet twist is invisible).
function taperedTube(curve: THREE.CatmullRomCurve3, seg: number, rad: number, rFn: (t: number) => number) {
  const frames = curve.computeFrenetFrames(seg, false);
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const P = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = rFn(t);
    for (let j = 0; j <= rad; j++) {
      const v = (j / rad) * Math.PI * 2;
      const cx = Math.cos(v), sy = Math.sin(v);
      verts.push(P.x + r * (cx * N.x + sy * B.x), P.y + r * (cx * N.y + sy * B.y), P.z + r * (cx * N.z + sy * B.z));
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = a + rad + 1, c = a + 1, d = b + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// Detail panel (unchanged from before, + concept chips)
// ---------------------------------------------------------------------------
function DetailPanel({ node, concepts, onClose }: { node: GlobalNode; concepts: string[]; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 lg:w-96 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-y-auto animate-tree-slide">
      <div className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 px-5 py-3 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{node.course ?? "Post"}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">&times;</button>
      </div>
      <div className="p-5">
        <h2 className="text-lg font-bold leading-snug mb-2">{node.title}</h2>
        {node.date && (
          <p className="text-xs text-gray-400 mb-3">{new Date(node.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · {node.readingTime} min read</p>
        )}
        {node.interactive && (
          <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 text-xs font-medium mb-3">Interactive</span>
        )}
        {concepts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {concepts.map((c) => (
              <span key={c} className="rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[11px] font-medium">{c}</span>
            ))}
          </div>
        )}
        {node.excerpt && <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{node.excerpt}</p>}
        <div className="space-y-2">
          {node.slug && node.course && (
            <a href={`/courses/${node.course.toLowerCase()}/${node.slug}`} className="block w-full text-center rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">Open full post →</a>
          )}
          {node.url && (
            <a href={node.url} target="_blank" rel="noopener noreferrer" className="block w-full text-center rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">View on blog ↗</a>
          )}
          <button onClick={() => { const url = `/courses/${node.course?.toLowerCase()}/${node.slug}`; navigator.clipboard.writeText(window.location.origin + url).catch(() => {}); }} className="block w-full text-center rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Copy link</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface Reg {
  mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  pivot: THREE.Vector3; basePos: THREE.Vector3; baseScale: number;
  growStart: number; growDur: number; kind: "trunk" | "branch" | "root" | "leaf" | "fruit";
  courseId?: string; interactive?: boolean; postId?: string; baseOpacity: number; baseEmissive: number;
}

export default function Galaxy3D({ graph }: { graph: GlobalGraph }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPost, setSelectedPost] = useState<GlobalNode | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [interactiveOnly, setInteractiveOnly] = useState(false);
  const [growthUi, setGrowthUi] = useState(1);

  // refs read by the render loop (avoid stale closures + per-frame re-render of scene)
  const selRef = useRef<string | null>(null);
  const ioRef = useRef(false);
  const hovRef = useRef<string | null>(null);
  const nbRef = useRef<Set<string>>(new Set());
  const growthRef = useRef(1);
  const playingRef = useRef(false);
  const flyRef = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null);

  // concept <-> post adjacency (for hover tendrils + panel chips)
  const { postConcepts, conceptPosts } = useMemo(() => {
    const pc = new Map<string, Set<string>>();
    const cp = new Map<string, Set<string>>();
    for (const l of graph.links) {
      if (l.type !== "concept") continue;
      const c = l.source.replace(/^concept-/, "");
      const p = l.target.replace(/^post-/, "");
      if (!pc.has(p)) pc.set(p, new Set()); pc.get(p)!.add(c);
      if (!cp.has(c)) cp.set(c, new Set()); cp.get(c)!.add(p);
    }
    return { postConcepts: pc, conceptPosts: cp };
  }, [graph]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => { selRef.current = selectedCourse; }, [selectedCourse]);
  useEffect(() => { ioRef.current = interactiveOnly; }, [interactiveOnly]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const rng = mulberry32(7);
    const randUnit = () => new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
    const UP = new THREE.Vector3(0, 1, 0);
    const YB = -7, YT = 7;
    const reg: Reg[] = [];
    const labels: { obj: CSS2DObject; el: HTMLDivElement; growStart: number; growDur: number; courseId?: string }[] = [];

    let W = container.clientWidth, H = container.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(W, H);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0";
    labelRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(labelRenderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.5, 140);
    camera.position.set(0, 1, 24);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4;
    controls.maxDistance = 46;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.addEventListener("start", () => { controls.autoRotate = false; });

    scene.add(new THREE.HemisphereLight(isDark ? 0x223055 : 0xffffff, isDark ? 0x0a0a12 : 0xd9d2c5, isDark ? 0.7 : 0.95));
    const dir = new THREE.DirectionalLight(isDark ? 0x9fb4ff : 0xffffff, isDark ? 0.5 : 0.7);
    dir.position.set(6, 12, 8);
    scene.add(dir);

    // faint drifting dust (life, not a starfield)
    const dustGeo = new THREE.BufferGeometry();
    const dv = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) { dv[i * 3] = (rng() - 0.5) * 34; dv[i * 3 + 1] = (rng() - 0.5) * 24; dv[i * 3 + 2] = (rng() - 0.5) * 34; }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dv, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: isDark ? 0x6b7a99 : 0x9aa3b2, size: 0.03, transparent: true, opacity: 0.22 }));
    scene.add(dust);

    // ---- dates ----
    const postNodes = graph.nodes.filter((n) => n.type === "post");
    const times = postNodes.map((n) => new Date(n.date ?? 0).getTime()).filter((t) => !isNaN(t));
    const gMin = Math.min(...times), gMax = Math.max(...times);
    const normG = (d?: string) => { const t = new Date(d ?? 0).getTime(); return gMax > gMin ? clamp((t - gMin) / (gMax - gMin), 0, 1) : 0.5; };
    const yOf = (n: number) => lerp(YB + 1.2, YT - 1.2, n);

    // ---- trunk ----
    const trunkPts: THREE.Vector3[] = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      trunkPts.push(new THREE.Vector3(Math.sin(t * Math.PI * 1.7 + 0.5) * 0.7, lerp(YB, YT, t), Math.cos(t * Math.PI * 1.3) * 0.6));
    }
    const trunkCurve = new THREE.CatmullRomCurve3(trunkPts);
    const trunkGeo = taperedTube(trunkCurve, 48, 10, (t) => 0.55 * Math.pow(1 - t, 0.7) + 0.1);
    const trunkPivot = trunkCurve.getPointAt(0);
    trunkGeo.translate(-trunkPivot.x, -trunkPivot.y, -trunkPivot.z);
    const trunkMat = new THREE.MeshStandardMaterial({ color: isDark ? BARK_DARK : BARK, roughness: 0.9, transparent: true });
    const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
    trunkMesh.position.copy(trunkPivot);
    trunkMesh.userData = { kind: "trunk" };
    scene.add(trunkMesh);
    reg.push({ mesh: trunkMesh, mat: trunkMat, pivot: trunkPivot.clone(), basePos: trunkPivot.clone(), baseScale: 1, growStart: 0, growDur: 0.18, kind: "trunk", baseOpacity: 1, baseEmissive: 0 });

    // ---- roots = top cross-course concepts ----
    const topConcepts = graph.nodes.filter((n) => n.type === "concept").sort((a, b) => (b.totalFreq ?? 0) - (a.totalFreq ?? 0)).slice(0, 4);
    topConcepts.forEach((cn, r) => {
      const az = (r / 4) * Math.PI * 2 + 0.4;
      const tilt = (120 * Math.PI) / 180;
      const dR = new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az));
      const len = 1.6 + rng() * 0.8;
      const c0 = trunkPivot.clone();
      const c1 = c0.clone().addScaledVector(dR, 0.6 * len);
      const c2 = c0.clone().addScaledVector(dR, len);
      const curve = new THREE.CatmullRomCurve3([c0, c1, c2]);
      const geo = taperedTube(curve, 10, 6, (t) => lerp(0.12, 0.01, t));
      geo.translate(-c0.x, -c0.y, -c0.z);
      const mat = new THREE.MeshStandardMaterial({ color: isDark ? ROOT_DARK : ROOT, roughness: 0.95, transparent: true });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(c0);
      scene.add(m);
      reg.push({ mesh: m, mat, pivot: c0.clone(), basePos: c0.clone(), baseScale: 1, growStart: 0, growDur: 0.12, kind: "root", baseOpacity: 1, baseEmissive: 0 });
      const el = document.createElement("div");
      el.textContent = cn.label;
      el.style.cssText = `color:${isDark ? "#9aa3b2" : "#7a7064"};font-size:10px;font-style:italic;opacity:0;pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,0.4);white-space:nowrap;`;
      const lab = new CSS2DObject(el);
      lab.position.copy(c2);
      scene.add(lab);
      labels.push({ obj: lab, el, growStart: 0.05, growDur: 0.2 });
    });

    // ---- courses -> branches + leaves ----
    const courses = [...new Set(graph.nodes.filter((n) => n.type === "course").map((n) => n.label))].sort();
    const pickables: THREE.Mesh[] = [trunkMesh];
    const leafGeo = (() => { const g = new THREE.CircleGeometry(1, 7); const p = g.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) p.setZ(i, p.getX(i) * p.getX(i) * 0.3); g.computeVertexNormals(); return g; })();
    const fruitGeo = new THREE.IcosahedronGeometry(1, 0);
    const meshByPost = new Map<string, THREE.Mesh>();

    courses.forEach((cid, i) => {
      const coursePosts = postNodes.filter((n) => n.course === cid).sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
      const firstN = normG(coursePosts[0]?.date);
      const pA = clamp((yOf(firstN) - YB) / (YT - YB), 0.02, 0.98);
      const attach = trunkCurve.getPointAt(pA);
      const az = (i / courses.length) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      const tilt = ((52 + rng() * 8) * Math.PI) / 180;
      const bdir = new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)).normalize();
      const L = clamp(2.2 + Math.sqrt(coursePosts.length) * 0.9, 2.6, 5.0);
      const baseR = clamp(0.05 + coursePosts.length * 0.012, 0.07, 0.18);
      const jv = randUnit().multiplyScalar(0.25 * L);
      const c0 = attach.clone();
      const c1 = attach.clone().addScaledVector(bdir, 0.5 * L).add(jv);
      const c2 = attach.clone().addScaledVector(bdir, L).addScaledVector(UP, 0.12 * L);
      const bcurve = new THREE.CatmullRomCurve3([c0, c1, c2]);
      const bgeo = taperedTube(bcurve, 14, 8, (t) => lerp(baseR, 0.02, t));
      bgeo.translate(-attach.x, -attach.y, -attach.z);
      const col = COURSE_COLORS[cid] ?? "#7c3aed";
      const bmat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, emissive: new THREE.Color(col).multiplyScalar(0.25), emissiveIntensity: 0.4, transparent: true });
      const bmesh = new THREE.Mesh(bgeo, bmat);
      bmesh.position.copy(attach);
      const courseGnode = graph.nodes.find((n) => n.id === `course-${cid}`)!;
      bmesh.userData = { kind: "course", courseId: cid, gnode: courseGnode };
      scene.add(bmesh);
      pickables.push(bmesh);
      const bgStart = clamp(firstN * 0.8 + 0.12, 0, 1);
      reg.push({ mesh: bmesh, mat: bmat, pivot: attach.clone(), basePos: attach.clone(), baseScale: 1, growStart: bgStart, growDur: 0.14, kind: "branch", courseId: cid, baseOpacity: 1, baseEmissive: 0.4 });

      // course label at mid-branch
      const mid = attach.clone().addScaledVector(bdir, 0.5 * L);
      const cel = document.createElement("div");
      cel.textContent = cid;
      cel.style.cssText = `color:${isDark ? tint(col, "#e6ebf5", 0.5).getStyle() : tint(col, "#1a1a1a", 0.25).getStyle()};font-size:13px;font-weight:800;letter-spacing:0.02em;opacity:0;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,0.5);white-space:nowrap;`;
      const clab = new CSS2DObject(cel);
      clab.position.copy(mid);
      scene.add(clab);
      labels.push({ obj: clab, el: cel, growStart: bgStart, growDur: 0.2, courseId: cid });

      // leaves
      const cTimes = coursePosts.map((p) => new Date(p.date ?? 0).getTime());
      const cMin = Math.min(...cTimes), cMax = Math.max(...cTimes);
      coursePosts.forEach((gnode) => {
        const tn = new Date(gnode.date ?? 0).getTime();
        const within = cMax > cMin ? (tn - cMin) / (cMax - cMin) : 0.5;
        const bp = bcurve.getPointAt(clamp(0.16 + 0.8 * within, 0, 1));
        const td = bdir.clone().add(randUnit().multiplyScalar(0.6)).normalize();
        const twig = 0.5 + rng() * 0.5;
        const leafWorld = bp.clone().addScaledVector(td, twig);
        const leafSize = clamp(0.16 + (gnode.readingTime ?? 1) * 0.02, 0.16, 0.42);
        const leafMat = new THREE.MeshStandardMaterial({
          color: tint(col, isDark ? "#cdd6e6" : "#ffffff", isDark ? 0.35 : 0.5),
          emissive: new THREE.Color(col).multiplyScalar(isDark ? 0.6 : 0.35),
          emissiveIntensity: 0.4, roughness: 0.7, side: THREE.DoubleSide, transparent: true,
        });
        const lm = new THREE.Mesh(leafGeo, leafMat);
        lm.quaternion.setFromUnitVectors(UP, td).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((rng() - 0.5) * 0.6, (rng() - 0.5) * 0.6, 0)));
        lm.userData = { kind: "leaf", gnode, postId: gnode.id.replace(/^post-/, "") };
        scene.add(lm);
        pickables.push(lm);
        meshByPost.set(gnode.id.replace(/^post-/, ""), lm);
        const lStart = clamp(normG(gnode.date) * 0.8 + 0.16, 0, 1);
        reg.push({ mesh: lm, mat: leafMat, pivot: attach.clone(), basePos: leafWorld, baseScale: leafSize, growStart: lStart, growDur: 0.09, kind: "leaf", courseId: cid, interactive: !!gnode.interactive, postId: gnode.id.replace(/^post-/, ""), baseOpacity: 1, baseEmissive: 0.4 });

        if (gnode.interactive) {
          const fmat = new THREE.MeshBasicMaterial({ color: INTERACTIVE, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
          const fm = new THREE.Mesh(fruitGeo, fmat);
          fm.userData = { kind: "leaf", gnode, postId: gnode.id.replace(/^post-/, "") };
          scene.add(fm);
          pickables.push(fm);
          reg.push({ mesh: fm, mat: fmat, pivot: attach.clone(), basePos: leafWorld, baseScale: leafSize * 2.4, growStart: lStart, growDur: 0.09, kind: "fruit", courseId: cid, interactive: true, postId: gnode.id.replace(/^post-/, ""), baseOpacity: 0.28, baseEmissive: 0 });
        }
      });
    });

    // ---- hover tendrils (rebuilt on hover) ----
    let tendril: THREE.LineSegments | null = null;
    const tendrilMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false });
    const setTendrils = (postId: string | null) => {
      if (tendril) { scene.remove(tendril); tendril.geometry.dispose(); tendril = null; }
      if (!postId) return;
      const a = meshByPost.get(postId);
      if (!a) return;
      const aw = new THREE.Vector3(); a.getWorldPosition(aw);
      const concepts = postConcepts.get(postId);
      if (!concepts || concepts.size === 0) return;
      const nb = new Set<string>();
      concepts.forEach((c) => (conceptPosts.get(c) ?? new Set()).forEach((q) => { if (q !== postId) nb.add(q); }));
      const pts: number[] = [];
      const col = new THREE.Color(COURSE_COLORS[a.userData.gnode?.course] ?? "#d98a2b");
      nb.forEach((q) => { const m = meshByPost.get(q); if (!m) return; const w = new THREE.Vector3(); m.getWorldPosition(w); pts.push(aw.x, aw.y, aw.z, w.x, w.y, w.z); });
      if (pts.length === 0) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      tendrilMat.color = col;
      tendril = new THREE.LineSegments(g, tendrilMat);
      scene.add(tendril);
    };

    // ---- raycast ----
    const raycaster = new THREE.Raycaster();
    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(m, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      if (hits.length) {
        const ud = hits[0].object.userData;
        container.style.cursor = "pointer";
        if (ud.kind === "leaf") {
          const g = ud.gnode as GlobalNode;
          hovRef.current = ud.postId;
          const concepts = postConcepts.get(ud.postId) ?? new Set();
          const nb = new Set<string>();
          concepts.forEach((c) => (conceptPosts.get(c) ?? new Set()).forEach((q) => { if (q !== ud.postId) nb.add(q); }));
          nbRef.current = nb;
          setTendrils(ud.postId);
          setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text: `${g.title}\n${g.course} · ${new Date(g.date ?? 0).toLocaleDateString()} · ${g.readingTime}m` });
        } else if (ud.kind === "course") {
          hovRef.current = null; nbRef.current = new Set(); setTendrils(null);
          setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text: `${ud.courseId}\n${(ud.gnode as GlobalNode).postCount ?? "?"} posts` });
        } else { hovRef.current = null; nbRef.current = new Set(); setTendrils(null); setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text: "Your MET journey" }); }
      } else {
        container.style.cursor = "grab";
        hovRef.current = null; nbRef.current = new Set(); setTendrils(null); setTooltip(null);
      }
    };
    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(m, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      if (!hits.length) return;
      const ud = hits[0].object.userData;
      if (ud.kind === "leaf") { setSelectedPost(ud.gnode as GlobalNode); }
      else if (ud.kind === "course") {
        const cid = ud.courseId as string;
        const coursePosts = postNodes.filter((n) => n.course === cid);
        const firstN = normG(coursePosts[0]?.date);
        const pA = clamp((yOf(firstN) - YB) / (YT - YB), 0.02, 0.98);
        const attach = trunkCurve.getPointAt(pA);
        const az = (courses.indexOf(cid) / courses.length) * Math.PI * 2;
        const tilt = (56 * Math.PI) / 180;
        const bdir = new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)).normalize();
        const look = attach.clone().addScaledVector(bdir, 2.2);
        const pos = look.clone().add(bdir.clone().addScaledVector(UP, 0.4).normalize().multiplyScalar(7));
        flyRef.current = { pos, look };
        setSelectedCourse((cur) => { const nx = cur === cid ? null : cid; selRef.current = nx; return nx; });
      }
    };
    container.addEventListener("mousemove", onMove);
    container.addEventListener("click", onClick);

    const onResize = () => {
      W = container.clientWidth; H = container.clientHeight;
      camera.aspect = W / H; camera.updateProjectionMatrix();
      renderer.setSize(W, H); labelRenderer.setSize(W, H);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    const _v = new THREE.Vector3();
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      if (playingRef.current) {
        growthRef.current = Math.min(1, growthRef.current + dt / 7);
        setGrowthUi(growthRef.current);
        if (growthRef.current >= 1) playingRef.current = false;
      }
      controls.update();
      if (flyRef.current) {
        camera.position.lerp(flyRef.current.pos, 0.06);
        controls.target.lerp(flyRef.current.look, 0.06);
        if (camera.position.distanceTo(flyRef.current.pos) < 0.15) flyRef.current = null;
      }
      dust.rotation.y += 0.0002;

      const gT = growthRef.current, sel = selRef.current, io = ioRef.current, hov = hovRef.current, nb = nbRef.current;
      for (const r of reg) {
        const raw = clamp((gT - r.growStart) / r.growDur, 0, 1);
        const s = (r.kind === "leaf" || r.kind === "fruit") ? easeOutBack(raw) : easeOutCubic(raw);
        r.mesh.scale.setScalar(r.baseScale * Math.max(s, 0.0001));
        r.mesh.position.copy(r.pivot).addScaledVector(_v.copy(r.basePos).sub(r.pivot), s);
        let op = r.baseOpacity;
        if (r.kind === "leaf" || r.kind === "fruit") op *= clamp(s * 2.5, 0, 1);
        if (r.kind !== "trunk" && r.kind !== "root" && sel && r.courseId !== sel) op *= 0.12;
        if (io && r.kind === "leaf" && !r.interactive) op *= 0.12;
        let em = r.baseEmissive;
        if (hov) {
          if (r.postId === hov) { em = r.baseEmissive * 2.2; }
          else if (r.postId && nb.has(r.postId)) { em = r.baseEmissive * 1.6; }
          else if (r.kind === "leaf" || r.kind === "fruit") { op *= 0.22; }
        }
        r.mat.opacity = op;
        if (r.mat instanceof THREE.MeshStandardMaterial) r.mat.emissiveIntensity = em;
      }
      for (const l of labels) {
        const raw = clamp((gT - l.growStart) / l.growDur, 0, 1);
        let o = raw;
        if (sel && l.courseId && l.courseId !== sel) o *= 0.15;
        l.el.style.opacity = String(o);
        l.obj.visible = raw > 0.01;
      }
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    // expose controls for HUD buttons
    (container as any).__tree = {
      reset: () => { flyRef.current = { pos: new THREE.Vector3(0, 1, 24), look: new THREE.Vector3(0, 0, 0) }; controls.autoRotate = true; setSelectedCourse(null); selRef.current = null; setInteractiveOnly(false); ioRef.current = false; },
      play: () => { growthRef.current = 0; playingRef.current = true; setGrowthUi(0); },
      scrub: (v: number) => { playingRef.current = false; growthRef.current = v; setGrowthUi(v); },
      toggleAuto: () => { controls.autoRotate = !controls.autoRotate; },
      flyCourse: (cid: string) => { onClick as any; const idx = courses.indexOf(cid); const coursePosts = postNodes.filter((n) => n.course === cid); const firstN = normG(coursePosts[0]?.date); const pA = clamp((yOf(firstN) - YB) / (YT - YB), 0.02, 0.98); const attach = trunkCurve.getPointAt(pA); const az = (idx / courses.length) * Math.PI * 2; const tilt = (56 * Math.PI) / 180; const bdir = new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)).normalize(); const look = attach.clone().addScaledVector(bdir, 2.2); flyRef.current = { pos: look.clone().add(bdir.clone().addScaledVector(UP, 0.4).normalize().multiplyScalar(7)), look }; },
    };

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode) container.removeChild(renderer.domElement);
      if (labelRenderer.domElement.parentNode) container.removeChild(labelRenderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark, graph]);

  const tree = (containerRef.current as any)?.__tree;
  const conceptsFor = (n: GlobalNode) => (n.slug ? [...(postConcepts.get(n.slug) ?? [])] : []);

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{
        height: "calc(100vh - 57px)",
        background: isDark
          ? "radial-gradient(120% 80% at 50% 0%, #141826 0%, #0a0a12 60%, #070709 100%)"
          : "radial-gradient(120% 80% at 50% 0%, #fbfcfe 0%, #f3f1ea 55%, #ece7dc 100%)",
      }}
    >
      {/* HUD bottom-left */}
      <div className="absolute bottom-4 left-5 z-10 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => tree?.play()} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/80 dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-colors">▶ Grow</button>
          <input type="range" min={0} max={1000} value={Math.round(growthUi * 1000)} onChange={(e) => tree?.scrub(Number(e.target.value) / 1000)} className="w-40 accent-blue-500" />
          <button onClick={() => tree?.toggleAuto()} className="px-2.5 py-1.5 rounded-full text-xs bg-white/70 dark:bg-gray-900/70 border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-colors">⟳ spin</button>
          <button onClick={() => tree?.reset()} className="px-2.5 py-1.5 rounded-full text-xs bg-white/70 dark:bg-gray-900/70 border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-colors">⤢ reset</button>
        </div>
        <span className="text-[11px] text-gray-500 dark:text-gray-400 pointer-events-none">drag to orbit · scroll to zoom · hover a leaf for its ideas · click a branch to focus</span>
      </div>

      {/* legend top-right = live course filter + interactive toggle */}
      <div className="absolute top-4 right-5 z-10 flex flex-col items-end gap-2 max-w-[70%]">
        <div className="flex flex-wrap gap-1.5 justify-end">
          {selectedCourse && (
            <button onClick={() => { setSelectedCourse(null); selRef.current = null; }} className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors">show all ✕</button>
          )}
          {[...new Set(graph.nodes.filter((n) => n.type === "course").map((n) => n.label))].sort().map((cid) => (
            <button key={cid} onClick={() => { const nx = selectedCourse === cid ? null : cid; setSelectedCourse(nx); selRef.current = nx; tree?.flyCourse(cid); }} style={{ borderColor: COURSE_COLORS[cid] }} className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${selectedCourse === cid ? "text-white" : "bg-white/70 dark:bg-gray-900/70 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800"}`}>
              {cid}
            </button>
          ))}
        </div>
        <button onClick={() => { const nx = !interactiveOnly; setInteractiveOnly(nx); ioRef.current = nx; }} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${interactiveOnly ? "bg-blue-500 text-white border-blue-500" : "bg-white/70 dark:bg-gray-900/70 border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800"}`}>
          interactive only
        </button>
      </div>

      {selectedPost && <DetailPanel node={selectedPost} concepts={conceptsFor(selectedPost)} onClose={() => setSelectedPost(null)} />}

      {tooltip && (
        <div className="absolute z-50 pointer-events-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 px-3 py-2 text-xs shadow-lg backdrop-blur-sm whitespace-pre-line max-w-[220px]" style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          {tooltip.text}
        </div>
      )}

      <style jsx>{`
        @keyframes tree-slide { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-tree-slide { animation: tree-slide 0.25s ease-out; }
      `}</style>
    </div>
  );
}
