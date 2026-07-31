"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { GlobalGraph, GlobalNode } from "@/lib/concepts";
import { isCleanConcept } from "@/lib/concepts";

// ---------------------------------------------------------------------------
// One earthy, distinct hue per course -> each course reads as one colored
// canopy. Background trees use muted sage so the central tree is the focus.
// ---------------------------------------------------------------------------
const COURSE_COLORS: Record<string, string> = {
  ETEC500: "#2f8f6b", ETEC510: "#2b8fb0", ETEC511: "#4f6fd1", ETEC512: "#8267d6",
  ETEC522: "#c2557a", ETEC531: "#d98a2b", ETEC542: "#c2683f", ETEC544: "#7fae3f",
};
const FALLBACK = "#9aa36b";
const INTERACTIVE = "#ffd27a"; // warm "fruit" glow (NOT red)

const BASE_Y = -7;
const TOP_Y = 7;
const MAXDEPTH = 3;
const UP = new THREE.Vector3(0, 1, 0);
const V1 = new THREE.Vector3(1, 1, 1);

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

// ---- textures (generated once) -------------------------------------------
function makeLeafTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d")!;
  x.clearRect(0, 0, 64, 64);
  x.fillStyle = "#ffffff";
  x.beginPath();
  x.moveTo(32, 3);
  x.bezierCurveTo(54, 14, 56, 44, 32, 61);
  x.bezierCurveTo(8, 44, 10, 14, 32, 3);
  x.closePath(); x.fill();
  x.strokeStyle = "rgba(255,255,255,0.35)"; x.lineWidth = 1.4;
  x.beginPath(); x.moveTo(32, 8); x.lineTo(32, 56); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.35, "rgba(255,225,150,0.55)");
  g.addColorStop(1, "rgba(255,210,120,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeSkyTexture(isDark: boolean): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 4; c.height = 256;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, 256);
  if (isDark) { g.addColorStop(0, "#0a1024"); g.addColorStop(0.55, "#16203c"); g.addColorStop(1, "#2a3550"); }
  else { g.addColorStop(0, "#b9d6ec"); g.addColorStop(0.55, "#dce7ee"); g.addColorStop(1, "#f1ece1"); }
  x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- clean the panel blurb (no code, no em-dashes; blank if still code) ---
function cleanBlurb(s?: string): string {
  if (!s) return "";
  let t = s;
  t = t.replace(/<style[^]*?<\/style>/gi, " ");
  t = t.replace(/<script[^]*?<\/script>/gi, " ");
  t = t.replace(/```[^]*?```/g, " ");
  t = t.replace(/`[^`]*`/g, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/https?:\/\/\S+/g, " ");
  t = t.replace(/[—–]/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  if (/[{};]/.test(t)) return "";
  if (/aria-|display\s*:|visibility\s*:|important|::?[\w-]+\s*\{/.test(t)) return "";
  if (t.length < 14) return "";
  if (t.length > 220) t = t.slice(0, 220).replace(/\s+\S*$/, "") + "…";
  return t;
}

// ---------------------------------------------------------------------------
function DetailPanel({ node, concepts, onClose }: { node: GlobalNode; concepts: string[]; onClose: () => void }) {
  const blurb = cleanBlurb(node.description) || cleanBlurb(node.excerpt);
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
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 text-xs font-medium mb-3">Interactive</span>
        )}
        {concepts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {concepts.map((c) => (
              <span key={c} className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-medium">{c}</span>
            ))}
          </div>
        )}
        {blurb && <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{blurb}</p>}
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
interface PostDesc { id: string; course: string; interactive: boolean; basePos: THREE.Vector3; attach: THREE.Vector3; leafY: number; color: string; gnode: GlobalNode; }
interface PostRT { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; pickIndex: number; pivot: THREE.Vector3; basePos: THREE.Vector3; growStart: number; growDur: number; course: string; postId: string; interactive: boolean; sprite?: THREE.Sprite; labelEl?: HTMLDivElement; labelObj?: CSS2DObject; }

export default function Galaxy3D({ graph }: { graph: GlobalGraph }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPost, setSelectedPost] = useState<GlobalNode | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [interactiveOnly, setInteractiveOnly] = useState(false);
  const [growthUi, setGrowthUi] = useState(1);

  const selRef = useRef<string | null>(null);
  const ioRef = useRef(false);
  const hovRef = useRef<string | null>(null);
  const nbRef = useRef<Set<string>>(new Set());
  const growthRef = useRef(1);
  const playingRef = useRef(false);
  const flyRef = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null);

  const { postConcepts, conceptPosts } = useMemo(() => {
    const pc = new Map<string, Set<string>>();
    const cp = new Map<string, Set<string>>();
    for (const l of graph.links) {
      if (l.type !== "concept") continue;
      const c = l.source.replace(/^concept-/, "");
      if (!isCleanConcept(c)) continue;
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
    const rng = mulberry32(1337);
    const randUnit = () => new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();

    let W = container.clientWidth, H = container.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDark ? 1.25 : 1.05;
    renderer.localClippingEnabled = true;
    container.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(W, H);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0";
    labelRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(labelRenderer.domElement);

    const scene = new THREE.Scene();
    const horizon = isDark ? "#2a3550" : "#f1ece1";
    scene.background = makeSkyTexture(isDark);
    scene.fog = new THREE.Fog(new THREE.Color(horizon), 16, 62);

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.5, 160);
    camera.position.set(0, 1.5, 25);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4;
    controls.maxDistance = 44;
    controls.target.set(0, 0.5, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.addEventListener("start", () => { controls.autoRotate = false; });

    scene.add(new THREE.HemisphereLight(isDark ? 0x9fb4ff : 0xffffff, isDark ? 0x10160c : 0xcfc7b4, isDark ? 0.95 : 1.15));
    const sun = new THREE.DirectionalLight(isDark ? 0xffe6b0 : 0xfff2d6, isDark ? 0.9 : 1.05);
    sun.position.set(9, 15, 7); scene.add(sun);
    const fill = new THREE.DirectionalLight(isDark ? 0x6f86c8 : 0xcfe0ff, isDark ? 0.25 : 0.35);
    fill.position.set(-8, 6, -6); scene.add(fill);

    const growPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), BASE_Y);

    // ground
    const groundMat = new THREE.MeshStandardMaterial({ color: isDark ? 0x0c120c : 0xcfc7b4, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = BASE_Y; scene.add(ground);

    const leafTex = makeLeafTexture();
    const glowTex = makeGlowTexture();
    const baseLeafMat = new THREE.MeshStandardMaterial({ map: leafTex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, transparent: true, depthWrite: true, roughness: 0.85, metalness: 0 });

    const barkMat = new THREE.MeshStandardMaterial({ color: isDark ? 0x6e5c49 : 0x7a6450, roughness: 0.95, metalness: 0, clippingPlanes: [growPlane] });
    const rootMat = new THREE.MeshStandardMaterial({ color: isDark ? 0x4a3c2e : 0x5a4636, roughness: 1, metalness: 0, transparent: true, clippingPlanes: [growPlane] });

    const windGroup = new THREE.Group(); scene.add(windGroup);

    // ---- build the central tree ------------------------------------------
    const postNodes = graph.nodes.filter((n) => n.type === "post");
    const times = postNodes.map((n) => new Date(n.date ?? 0).getTime()).filter((t) => !isNaN(t));
    const gMin = Math.min(...times), gMax = Math.max(...times);
    const normG = (d?: string) => { const t = new Date(d ?? 0).getTime(); return gMax > gMin ? clamp((t - gMin) / (gMax - gMin), 0, 1) : 0.5; };

    const branchGeos: THREE.BufferGeometry[] = [];
    const rootGeos: THREE.BufferGeometry[] = [];
    const postDescs: PostDesc[] = [];
    const courseAnchors = new Map<string, { labelPos: THREE.Vector3; flyLook: THREE.Vector3; flyPos: THREE.Vector3; color: string }>();
    const limbHits: { geo: THREE.BufferGeometry; courseId: string }[] = [];

    const addBranch = (start: THREE.Vector3, dir: THREE.Vector3, len: number, rBot: number, rTop: number) => {
      const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir);
      const g = new THREE.CylinderGeometry(rTop, rBot, len, 9, 1, false);
      g.translate(0, len / 2, 0);
      g.applyMatrix4(new THREE.Matrix4().compose(start, quat, V1));
      branchGeos.push(g);
      return start.clone().addScaledVector(dir, len);
    };

    // trunk: gentle 3-segment curve
    const trunkPts = [
      new THREE.Vector3(0, BASE_Y, 0),
      new THREE.Vector3(0.5, BASE_Y + 4.6, 0.2),
      new THREE.Vector3(-0.3, BASE_Y + 9.3, -0.2),
      new THREE.Vector3(0.2, TOP_Y, 0.1),
    ];
    const trunkR = [0.62, 0.46, 0.32, 0.2];
    for (let i = 0; i < trunkPts.length - 1; i++) {
      const d = trunkPts[i + 1].clone().sub(trunkPts[i]); const len = d.length(); d.normalize();
      addBranch(trunkPts[i], d, len, trunkR[i], trunkR[i + 1]);
    }
    // trunk pick hit
    const trunkHitGeo = new THREE.CylinderGeometry(0.7, 0.9, TOP_Y - BASE_Y, 8);
    trunkHitGeo.translate(0, (TOP_Y + BASE_Y) / 2, 0);

    // roots (aesthetic, unlabeled)
    for (let r = 0; r < 5; r++) {
      const az = (r / 5) * Math.PI * 2 + rng() * 0.6;
      const tilt = (118 * Math.PI) / 180;
      const d = new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az));
      const len = 1.8 + rng() * 1.0;
      const c0 = trunkPts[0].clone();
      const quat = new THREE.Quaternion().setFromUnitVectors(UP, d);
      const g = new THREE.CylinderGeometry(0.02, 0.16, len, 7); g.translate(0, len / 2, 0);
      g.applyMatrix4(new THREE.Matrix4().compose(c0, quat, V1));
      rootGeos.push(g);
    }

    // recursive limb
    const limb = (start: THREE.Vector3, dir: THREE.Vector3, len: number, radius: number, depth: number, limbStart: THREE.Vector3, color: string, course: string, terminals: { pos: THREE.Vector3; dist: number }[]) => {
      const end = addBranch(start, dir, len, radius, radius * 0.6);
      terminals.push({ pos: end.clone(), dist: end.distanceTo(limbStart) });
      if (depth < MAXDEPTH) {
        const nc = depth === 1 ? 3 : 2;
        for (let k = 0; k < nc; k++) {
          const spread = 0.55 + rng() * 0.4;
          const az = (k / nc) * Math.PI * 2 + rng() * 1.4;
          const perp = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
          perp.addScaledVector(dir, -perp.dot(dir)).normalize();
          const upBias = 0.4;
          const childDir = dir.clone().multiplyScalar(1 - upBias).addScaledVector(perp, spread).addScaledVector(UP, upBias * 0.7).normalize();
          limb(end, childDir, len * 0.64, radius * 0.6, depth + 1, limbStart, color, course, terminals);
        }
      }
    };

    const courses = [...new Set(graph.nodes.filter((n) => n.type === "course").map((n) => n.label))].sort();
    courses.forEach((cid, i) => {
      const coursePosts = postNodes.filter((n) => n.course === cid).sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
      const color = COURSE_COLORS[cid] ?? FALLBACK;
      const firstN = normG(coursePosts[0]?.date);
      const pA = clamp((lerp(BASE_Y + 1.5, TOP_Y - 1.5, firstN) - BASE_Y) / (TOP_Y - BASE_Y), 0.05, 0.95);
      const attach = new THREE.Vector3(
        lerp(trunkPts[0].x, trunkPts[3].x, pA) + (pA < 0.5 ? 0.5 : -0.3) * (1 - Math.abs(pA - 0.5) * 2),
        lerp(BASE_Y, TOP_Y, pA),
        lerp(trunkPts[0].z, trunkPts[3].z, pA),
      );
      const az = (i / courses.length) * Math.PI * 2 + (rng() - 0.5) * 0.4;
      const tilt = ((54 + rng() * 8) * Math.PI) / 180;
      const limbDir = new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)).normalize();
      const limbLen = clamp(2.6 + Math.sqrt(coursePosts.length) * 0.62, 3.0, 5.2);
      const limbR = clamp(0.12 + coursePosts.length * 0.012, 0.13, 0.22);

      const terminals: { pos: THREE.Vector3; dist: number }[] = [];
      limb(attach, limbDir, limbLen, limbR, 1, attach, color, cid, terminals);
      terminals.sort((a, b) => a.dist - b.dist);

      // limb pick hit (clickable branch)
      const lhQuat = new THREE.Quaternion().setFromUnitVectors(UP, limbDir);
      const lhGeo = new THREE.CylinderGeometry(0.45, 0.6, limbLen * 0.8, 8); lhGeo.translate(0, limbLen * 0.4, 0);
      lhGeo.applyMatrix4(new THREE.Matrix4().compose(attach, lhQuat, V1));
      limbHits.push({ geo: lhGeo, courseId: cid });

      const mid = attach.clone().addScaledVector(limbDir, limbLen * 0.55);
      const tip = attach.clone().addScaledVector(limbDir, limbLen);
      const camOut = limbDir.clone().addScaledVector(UP, 0.35).normalize();
      courseAnchors.set(cid, { labelPos: mid.clone().addScaledVector(UP, 0.5), flyLook: mid.clone(), flyPos: mid.clone().addScaledVector(camOut, 7.5), color });

      // assign posts to terminals (chronological near->far)
      coursePosts.forEach((gnode, pi) => {
        const term = terminals[pi % terminals.length];
        const leafPos = term.pos.clone().addScaledVector(limbDir, 0.25);
        postDescs.push({ id: gnode.id.replace(/^post-/, ""), course: cid, interactive: !!gnode.interactive, basePos: leafPos, attach: attach.clone(), leafY: leafPos.y, color, gnode });
      });
    });

    // merge static branch + root geometry
    const centralBranches = new THREE.Mesh(mergeGeometries(branchGeos, false)!, barkMat); scene.add(centralBranches);
    const rootsMesh = new THREE.Mesh(mergeGeometries(rootGeos, false)!, rootMat); scene.add(rootsMesh);

    // ---- leaf tufts + pick instances + fruits + post labels --------------
    const buildTuft = (color: string): THREE.BufferGeometry => {
      const base = new THREE.Color(color);
      const geos: THREE.BufferGeometry[] = [];
      const n = 7;
      for (let k = 0; k < n; k++) {
        const size = 0.5 + rng() * 0.5;
        const pg = new THREE.PlaneGeometry(size, size);
        const cnt = pg.attributes.position.count;
        const cols = new Float32Array(cnt * 3);
        const tint = base.clone().multiplyScalar(0.72 + rng() * 0.5);
        for (let v = 0; v < cnt; v++) { cols[v * 3] = tint.r; cols[v * 3 + 1] = tint.g; cols[v * 3 + 2] = tint.b; }
        pg.setAttribute("color", new THREE.BufferAttribute(cols, 3));
        const off = randUnit().multiplyScalar(0.55 + rng() * 0.45);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI));
        pg.applyMatrix4(new THREE.Matrix4().compose(off, q, V1));
        geos.push(pg);
      }
      return mergeGeometries(geos, false)!;
    };

    const postRuntime: PostRT[] = [];
    const postByInstance: GlobalNode[] = [];
    const pickGeo = new THREE.SphereGeometry(1, 10, 10); pickGeo.computeBoundingSphere();
    const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    const pickInst = new THREE.InstancedMesh(pickGeo, pickMat, Math.max(postDescs.length, 1));
    pickInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    windGroup.add(pickInst);

    postDescs.forEach((pd, idx) => {
      const mat = baseLeafMat.clone();
      mat.emissive = new THREE.Color(pd.color);
      mat.emissiveIntensity = 0;
      const mesh = new THREE.Mesh(buildTuft(pd.color), mat);
      mesh.userData = { kind: "leaf", postId: pd.id };
      windGroup.add(mesh);
      let sprite: THREE.Sprite | undefined;
      if (pd.interactive) {
        const sm = new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(INTERACTIVE), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        sprite = new THREE.Sprite(sm); sprite.scale.setScalar(1.5); windGroup.add(sprite);
      }
      // post submenu label
      const el = document.createElement("div");
      el.textContent = pd.gnode.title && pd.gnode.title.length > 34 ? pd.gnode.title.slice(0, 32) + "…" : pd.gnode.title;
      el.style.cssText = `color:${isDark ? "#eef2fb" : "#1d2433"};font-size:11px;font-weight:600;background:${isDark ? "rgba(15,20,34,0.78)" : "rgba(255,255,255,0.82)"};padding:2px 7px;border-radius:9px;border:1px solid ${pd.color}66;opacity:0;white-space:nowrap;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:opacity .2s;`;
      el.style.pointerEvents = "none";
      el.addEventListener("click", (ev) => { ev.stopPropagation(); setSelectedPost(pd.gnode); });
      const labelObj = new CSS2DObject(el);
      labelObj.position.copy(pd.basePos).add(new THREE.Vector3(0, 0.7, 0));
      windGroup.add(labelObj);

      postByInstance.push(pd.gnode);
      postRuntime.push({ mesh, mat, pickIndex: idx, pivot: pd.attach, basePos: pd.basePos, growStart: clamp((pd.leafY - BASE_Y) / (TOP_Y - BASE_Y), 0, 1) * 0.82 + 0.04, growDur: 0.14, course: pd.course, postId: pd.id, interactive: pd.interactive, sprite, labelEl: el, labelObj });
    });

    // ---- invisible clickable hits (branches + trunk) ---------------------
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    const hitMeshes: THREE.Mesh[] = [];
    const trunkHit = new THREE.Mesh(trunkHitGeo, hitMat); trunkHit.userData = { kind: "trunk" }; scene.add(trunkHit); hitMeshes.push(trunkHit);
    const courseHitMeshes: THREE.Mesh[] = [];
    limbHits.forEach((lh) => { const m = new THREE.Mesh(lh.geo, hitMat); m.userData = { kind: "course", courseId: lh.courseId }; scene.add(m); hitMeshes.push(m); courseHitMeshes.push(m); });

    // ---- course labels (always-on pills, the menu headers) ---------------
    const courseLabels: { el: HTMLDivElement; obj: CSS2DObject; cid: string }[] = [];
    courses.forEach((cid) => {
      const a = courseAnchors.get(cid)!;
      const el = document.createElement("div");
      el.textContent = cid;
      el.style.cssText = `color:${isDark ? "#f3f6ff" : "#1d2433"};font-size:12px;font-weight:800;letter-spacing:.03em;background:${a.color}cc;padding:3px 9px;border-radius:11px;opacity:0;white-space:nowrap;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,0.35);transition:opacity .2s;`;
      el.addEventListener("click", (ev) => { ev.stopPropagation(); const nx = selRef.current === cid ? null : cid; setSelectedCourse(nx); selRef.current = nx; flyRef.current = { pos: a.flyPos.clone(), look: a.flyLook.clone() }; });
      const obj = new CSS2DObject(el); obj.position.copy(a.labelPos); scene.add(obj);
      courseLabels.push({ el, obj, cid });
    });

    // ---- background forest (receding, muted) -----------------------------
    const bgMats: THREE.Material[] = [];
    const bgLeafMat = new THREE.MeshStandardMaterial({ map: leafTex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, transparent: true, depthWrite: true, roughness: 0.9 });
    bgMats.push(bgLeafMat);
    const bgBarkMat = new THREE.MeshStandardMaterial({ color: isDark ? 0x3a3328 : 0x6a5a48, roughness: 1, transparent: true });
    bgMats.push(bgBarkMat);
    const bgTree = (ox: number, oz: number, sc: number) => {
      const bGeos: THREE.BufferGeometry[] = []; const lGeos: THREE.BufferGeometry[] = [];
      const base = new THREE.Vector3(ox, BASE_Y, oz);
      const rec = (start: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
        const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir);
        const g = new THREE.CylinderGeometry(rad * 0.6, rad, len, 6); g.translate(0, len / 2, 0);
        g.applyMatrix4(new THREE.Matrix4().compose(start, quat, new THREE.Vector3(sc, sc, sc)));
        // bake base offset
        g.translate(ox, 0, oz);
        bGeos.push(g);
        const end = start.clone().multiplyScalar(sc).add(new THREE.Vector3(ox, 0, oz)).sub(new THREE.Vector3(ox, 0, oz)); // placeholder
        const worldEnd = new THREE.Vector3(ox, BASE_Y, oz).add(start.clone().sub(new THREE.Vector3(0, 0, 0)).multiplyScalar(sc)).addScaledVector(dir, len * sc);
        if (depth >= 2) {
          for (let k = 0; k < 4; k++) {
            const pg = new THREE.PlaneGeometry(1.4 * sc, 1.4 * sc);
            const cnt = pg.attributes.position.count; const cols = new Float32Array(cnt * 3);
            const tint = new THREE.Color(isDark ? 0x3f6b46 : 0x6f9a5e).multiplyScalar(0.8 + rng() * 0.4);
            for (let v = 0; v < cnt; v++) { cols[v * 3] = tint.r; cols[v * 3 + 1] = tint.g; cols[v * 3 + 2] = tint.b; }
            pg.setAttribute("color", new THREE.BufferAttribute(cols, 3));
            const off = randUnit().multiplyScalar(1.1 * sc);
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI));
            pg.applyMatrix4(new THREE.Matrix4().compose(worldEnd.clone().add(off), q, V1));
            lGeos.push(pg);
          }
        }
        if (depth < 3) {
          const nc = depth === 0 ? 3 : 2;
          for (let k = 0; k < nc; k++) {
            const az = (k / nc) * Math.PI * 2 + rng() * 1.4;
            const perp = new THREE.Vector3(Math.cos(az), 0, Math.sin(az)); perp.addScaledVector(dir, -perp.dot(dir)).normalize();
            const cd = dir.clone().multiplyScalar(0.6).addScaledVector(perp, 0.6).addScaledVector(UP, 0.3).normalize();
            rec(start.clone().addScaledVector(dir, len), cd, len * 0.66, rad * 0.6, depth + 1);
          }
        }
      };
      rec(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0).add(randUnit().multiplyScalar(0.12)).normalize(), 4.5, 0.4, 0);
      const bm = new THREE.Mesh(mergeGeometries(bGeos, false)!, bgBarkMat); scene.add(bm);
      const lm = new THREE.Mesh(mergeGeometries(lGeos, false)!, bgLeafMat); scene.add(lm);
    };
    [0, 1, 2, 3, 4].forEach((i) => {
      const a = (i / 5) * Math.PI * 2 + 0.6; const r = 20 + rng() * 8;
      bgTree(Math.cos(a) * r, Math.sin(a) * r - 6, 0.7 + rng() * 0.5);
    });

    // ---- drifting pollen -------------------------------------------------
    const pollenGeo = new THREE.BufferGeometry();
    const pN = 220; const pPos = new Float32Array(pN * 3);
    for (let i = 0; i < pN; i++) { pPos[i * 3] = (rng() - 0.5) * 40; pPos[i * 3 + 1] = BASE_Y + rng() * 18; pPos[i * 3 + 2] = (rng() - 0.5) * 40; }
    pollenGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pollen = new THREE.Points(pollenGeo, new THREE.PointsMaterial({ color: isDark ? 0xffe6b0 : 0xffffff, size: 0.06, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(pollen);

    // ---- hover tendrils --------------------------------------------------
    let tendril: THREE.LineSegments | null = null;
    const tendrilMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false });
    const setTendrils = (postId: string | null) => {
      if (tendril) { scene.remove(tendril); tendril.geometry.dispose(); tendril = null; }
      if (!postId) return;
      const pr = postRuntime.find((p) => p.postId === postId); if (!pr) return;
      const aw = new THREE.Vector3(); pr.mesh.getWorldPosition(aw);
      const concepts = postConcepts.get(postId); if (!concepts || concepts.size === 0) return;
      const nb = new Set<string>(); concepts.forEach((c) => (conceptPosts.get(c) ?? new Set()).forEach((q) => { if (q !== postId) nb.add(q); }));
      const pts: number[] = [];
      nb.forEach((q) => { const o = postRuntime.find((p) => p.postId === q); if (!o) return; const w = new THREE.Vector3(); o.mesh.getWorldPosition(w); pts.push(aw.x, aw.y, aw.z, w.x, w.y, w.z); });
      if (pts.length === 0) return;
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      tendrilMat.color = new THREE.Color(pr.course ? COURSE_COLORS[pr.course] ?? FALLBACK : FALLBACK);
      tendril = new THREE.LineSegments(g, tendrilMat); scene.add(tendril);
    };

    // ---- raycast ---------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const pickTargets = [pickInst, ...hitMeshes];
    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(m, camera);
      const hits = raycaster.intersectObjects(pickTargets, false);
      if (hits.length) {
        const o = hits[0].object; container.style.cursor = "pointer";
        if (o === pickInst) {
          const id = (hits[0] as any).instanceId as number; const g = postByInstance[id];
          hovRef.current = g.id.replace(/^post-/, "");
          const concepts = postConcepts.get(g.id.replace(/^post-/, "")) ?? new Set();
          const nb = new Set<string>(); concepts.forEach((c) => (conceptPosts.get(c) ?? new Set()).forEach((q) => nb.add(q))); nbRef.current = nb;
          setTendrils(g.id.replace(/^post-/, ""));
          setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text: `${g.title}\n${g.course} · ${new Date(g.date ?? 0).toLocaleDateString()} · ${g.readingTime}m` });
        } else if (o.userData.kind === "course") {
          hovRef.current = null; nbRef.current = new Set(); setTendrils(null);
          setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text: `${o.userData.courseId}\nclick to focus` });
        } else { hovRef.current = null; nbRef.current = new Set(); setTendrils(null); setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text: "Your MET journey" }); }
      } else { container.style.cursor = "grab"; hovRef.current = null; nbRef.current = new Set(); setTendrils(null); setTooltip(null); }
    };
    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const m = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(m, camera);
      const hits = raycaster.intersectObjects(pickTargets, false);
      if (!hits.length) return;
      const o = hits[0].object;
      if (o === pickInst) { const id = (hits[0] as any).instanceId as number; setSelectedPost(postByInstance[id]); }
      else if (o.userData.kind === "course") {
        const cid = o.userData.courseId as string; const a = courseAnchors.get(cid)!;
        flyRef.current = { pos: a.flyPos.clone(), look: a.flyLook.clone() };
        const nx = selRef.current === cid ? null : cid; setSelectedCourse(nx); selRef.current = nx;
      } else { flyRef.current = { pos: new THREE.Vector3(0, 1.5, 25), look: new THREE.Vector3(0, 0.5, 0) }; setSelectedCourse(null); selRef.current = null; }
    };
    container.addEventListener("mousemove", onMove);
    container.addEventListener("click", onClick);

    const onResize = () => { W = container.clientWidth; H = container.clientHeight; camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H); labelRenderer.setSize(W, H); };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    const _cur = new THREE.Vector3(); const _m4 = new THREE.Matrix4(); const _q0 = new THREE.Quaternion();
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = clock.getDelta(); const t = clock.elapsedTime;
      if (playingRef.current) { growthRef.current = Math.min(1, growthRef.current + dt / 7); setGrowthUi(growthRef.current); if (growthRef.current >= 1) playingRef.current = false; }
      controls.update();
      if (flyRef.current) { camera.position.lerp(flyRef.current.pos, 0.06); controls.target.lerp(flyRef.current.look, 0.06); if (camera.position.distanceTo(flyRef.current.pos) < 0.15) flyRef.current = null; }

      const gT = growthRef.current;
      growPlane.constant = lerp(BASE_Y, TOP_Y + 1, easeOutCubic(gT));
      rootsMesh.material.opacity = clamp(gT / 0.12, 0, 1);
      bgMats.forEach((mm) => { (mm as THREE.MeshStandardMaterial).opacity = clamp(gT / 0.25, 0, 1); });
      windGroup.rotation.z = Math.sin(t * 0.5) * 0.012;
      windGroup.rotation.x = Math.sin(t * 0.37 + 1.3) * 0.008;
      pollen.rotation.y += 0.0003;
      const pp = pollenGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pN; i++) { let y = pp.getY(i) + dt * 0.25; if (y > TOP_Y + 4) y = BASE_Y; pp.setY(i, y); }
      pp.needsUpdate = true;

      const sel = selRef.current, io = ioRef.current, hov = hovRef.current, nb = nbRef.current;
      const camClose = camera.position.distanceTo(controls.target) < 15;
      for (const pr of postRuntime) {
        const raw = clamp((gT - pr.growStart) / pr.growDur, 0, 1);
        const s = easeOutBack(raw);
        _cur.copy(pr.pivot).addScaledVector(_cur.copy(pr.basePos).sub(pr.pivot).normalize().multiplyScalar(pr.basePos.distanceTo(pr.pivot)), easeOutCubic(raw));
        // recompute properly:
        const dir = pr.basePos.clone().sub(pr.pivot); const dl = dir.length(); dir.normalize();
        _cur.copy(pr.pivot).addScaledVector(dir, dl * easeOutCubic(raw));
        pr.mesh.position.copy(_cur);
        pr.mesh.scale.setScalar(Math.max(s, 0.0001));
        let op = clamp(s * 2.2, 0, 1);
        if (sel && pr.course !== sel) op *= 0.1;
        if (io && !pr.interactive) op *= 0.1;
        let em = 0;
        if (hov) { if (pr.postId === hov) em = 0.7; else if (nb.has(pr.postId)) em = 0.4; else op *= 0.2; }
        pr.mat.opacity = op; pr.mat.emissiveIntensity = em;
        _m4.compose(_cur, _q0, new THREE.Vector3(0.62 * Math.max(s, 0.0001), 0.62 * Math.max(s, 0.0001), 0.62 * Math.max(s, 0.0001)));
        pickInst.setMatrixAt(pr.pickIndex, _m4);
        if (pr.sprite) { pr.sprite.position.copy(_cur); pr.sprite.scale.setScalar(1.5 * Math.max(s, 0.0001)); (pr.sprite.material as THREE.SpriteMaterial).opacity = op * 0.8; }
        if (pr.labelEl) {
          const show = sel === pr.course && camClose;
          const lo = show ? clamp(raw, 0, 1) : 0;
          pr.labelEl.style.opacity = String(lo);
          pr.labelEl.style.pointerEvents = lo > 0.5 ? "auto" : "none";
        }
      }
      pickInst.instanceMatrix.needsUpdate = true;
      for (const cl of courseLabels) {
        const o = (sel && sel !== cl.cid) ? 0.18 : clamp((gT - 0.1) / 0.2, 0, 1);
        cl.el.style.opacity = String(o);
      }
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    (container as any).__tree = {
      reset: () => { flyRef.current = { pos: new THREE.Vector3(0, 1.5, 25), look: new THREE.Vector3(0, 0.5, 0) }; controls.autoRotate = true; setSelectedCourse(null); selRef.current = null; setInteractiveOnly(false); ioRef.current = false; },
      play: () => { growthRef.current = 0; playingRef.current = true; setGrowthUi(0); },
      scrub: (v: number) => { playingRef.current = false; growthRef.current = v; setGrowthUi(v); },
      toggleAuto: () => { controls.autoRotate = !controls.autoRotate; },
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
  const conceptsFor = (n: GlobalNode) => (n.slug ? [...(postConcepts.get(n.slug) ?? [])].filter(isCleanConcept).slice(0, 6) : []);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: "calc(100vh - 57px)" }}>
      {/* focus vignette */}
      <div className="pointer-events-none absolute inset-0 z-[5]" style={{ background: isDark ? "radial-gradient(120% 90% at 50% 42%, transparent 55%, rgba(0,0,0,0.45) 100%)" : "radial-gradient(120% 90% at 50% 42%, transparent 60%, rgba(120,110,90,0.18) 100%)" }} />

      {/* HUD bottom-left */}
      <div className="absolute bottom-4 left-5 z-20 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => tree?.play()} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/85 dark:bg-gray-900/85 border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-colors">▶ Grow</button>
          <input type="range" min={0} max={1000} value={Math.round(growthUi * 1000)} onChange={(e) => tree?.scrub(Number(e.target.value) / 1000)} className="w-40 accent-emerald-500" />
          <button onClick={() => tree?.toggleAuto()} className="px-2.5 py-1.5 rounded-full text-xs bg-white/70 dark:bg-gray-900/70 border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-colors">⟳ spin</button>
          <button onClick={() => tree?.reset()} className="px-2.5 py-1.5 rounded-full text-xs bg-white/70 dark:bg-gray-900/70 border border-gray-300 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-colors">⤢ reset</button>
        </div>
        <span className="text-[11px] text-gray-500 dark:text-gray-400 pointer-events-none">drag to orbit · scroll to zoom · hover a leaf for its ideas · click a branch to open its course</span>
      </div>

      {/* legend top-right = live course filter + interactive toggle */}
      <div className="absolute top-4 right-5 z-20 flex flex-col items-end gap-2 max-w-[78%]">
        <div className="flex flex-wrap gap-1.5 justify-end">
          {selectedCourse && (
            <button onClick={() => { setSelectedCourse(null); selRef.current = null; }} className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">show all ✕</button>
          )}
          {[...new Set(graph.nodes.filter((n) => n.type === "course").map((n) => n.label))].sort().map((cid) => (
            <button key={cid} onClick={() => { const nx = selectedCourse === cid ? null : cid; setSelectedCourse(nx); selRef.current = nx; }} style={{ borderColor: COURSE_COLORS[cid] ?? FALLBACK }} className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${selectedCourse === cid ? "text-white" : "bg-white/75 dark:bg-gray-900/75 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800"}`}>
              {cid}
            </button>
          ))}
        </div>
        <button onClick={() => { const nx = !interactiveOnly; setInteractiveOnly(nx); ioRef.current = nx; }} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${interactiveOnly ? "bg-amber-500 text-white border-amber-500" : "bg-white/70 dark:bg-gray-900/70 border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800"}`}>
          interactive only
        </button>
      </div>

      {selectedPost && <DetailPanel node={selectedPost} concepts={conceptsFor(selectedPost)} onClose={() => setSelectedPost(null)} />}

      {tooltip && (
        <div className="absolute z-50 pointer-events-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white/92 dark:bg-gray-900/92 px-3 py-2 text-xs shadow-lg backdrop-blur-sm whitespace-pre-line max-w-[240px]" style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
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
