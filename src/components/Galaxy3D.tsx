"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { GlobalGraph, GlobalNode } from "@/lib/concepts";

// ---------------------------------------------------------------------------
// Palette — course colors (violet family variants)
// ---------------------------------------------------------------------------

const COURSE_COLORS: Record<string, string> = {
  ETEC500: "#7c3aed", ETEC510: "#6d28d9", ETEC511: "#5b21b6",
  ETEC512: "#8b5cf6", ETEC522: "#a78bfa", ETEC531: "#4c1d95",
  ETEC542: "#7e22ce", ETEC544: "#9333ea",
};

const POST_COLOR = "#64748b";
const POST_COLOR_EMISSIVE = "#1e293b";
const CONCEPT_COLOR = "#f59e0b";
const CONCEPT_EMISSIVE = "#b45309";
const INTERACTIVE_RING = "#fbbf24";
const HELIX_COLOR = "#6366f1";
const STARFIELD_COLOR = "#cbd5e1";

// Theme backgrounds
const BG_DARK = 0x0a0a0a;
const BG_LIGHT = 0xf1f5f9;
const FOG_DARK = 0x1e1b4b;
const FOG_LIGHT = 0xe2e8f0;

// ---------------------------------------------------------------------------
// Detail panel (HTML overlay)
// ---------------------------------------------------------------------------

function DetailPanel({ node, onClose }: { node: GlobalNode; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 lg:w-96 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 overflow-y-auto animate-slide-in">
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
        {node.excerpt && <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{node.excerpt}</p>}
        <div className="space-y-2">
          {node.slug && node.course && (
            <a href={`/courses/${node.course.toLowerCase()}/${node.slug}`} className="block w-full text-center rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
              Open full post →
            </a>
          )}
          {node.url && (
            <a href={node.url} target="_blank" rel="noopener noreferrer" className="block w-full text-center rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
              View on blog ↗
            </a>
          )}
          <button onClick={() => { const url = `/courses/${node.course?.toLowerCase()}/${node.slug}`; navigator.clipboard.writeText(window.location.origin + url).catch(() => {}); }} className="block w-full text-center rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            Copy link
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3D Scene data
// ---------------------------------------------------------------------------

interface SceneNode {
  id: string;
  type: "course" | "post" | "concept";
  label: string;
  position: THREE.Vector3;
  color: string;
  radius: number;
  gnode: GlobalNode;
  // for concept filaments
  linkedPostIds?: string[];
}

interface SceneData {
  nodes: SceneNode[];
  filaments: { from: THREE.Vector3; to: THREE.Vector3; color: string; weight: number }[];
}

function buildSceneData(graph: GlobalGraph, isDark: boolean): SceneData {
  const w = 12, h = 16; // scene bounds
  const courses = [...new Set(graph.nodes.filter(n => n.type === "course").map(n => n.label))];
  const courseCount = courses.length;

  // Helix: place courses along a 3D spiral
  const coursePositions: Record<string, THREE.Vector3> = {};
  courses.forEach((cid, i) => {
    const t = i / (courseCount - 1 || 1);
    const angle = t * Math.PI * 2.5;
    const x = Math.cos(angle) * w * 0.35;
    const z = Math.sin(angle) * w * 0.35;
    const y = (t - 0.5) * h * 0.6;
    coursePositions[cid] = new THREE.Vector3(x, y, z);
  });

  const conceptPositions: Record<string, THREE.Vector3> = {};
  const postPositions: Record<string, THREE.Vector3> = {};
  const sceneNodes: SceneNode[] = [];

  // Course nodes
  for (const [cid, pos] of Object.entries(coursePositions)) {
    const gnode = graph.nodes.find(n => n.id === `course-${cid}`)!;
    sceneNodes.push({ id: `course-${cid}`, type: "course", label: cid, position: pos.clone(), color: COURSE_COLORS[cid] ?? "#7c3aed", radius: 1.0, gnode: gnode ?? { id: cid, type: "course", label: cid } as GlobalNode });
  }

  // Post nodes — bloom around course anchors
  const rng = mulberry32(42);
  for (const cid of courses) {
    const anchor = coursePositions[cid];
    const coursePosts = graph.nodes.filter(n => n.type === "post" && n.course === cid);
    const radius = 1.8 + coursePosts.length * 0.1;
    coursePosts.forEach((gnode, j) => {
      const phi = Math.acos(2 * (j + 0.5) / coursePosts.length - 1);
      const theta = (j * 2.4 + rng()) * Math.PI;
      const r = radius * (0.4 + rng() * 0.6);
      const x = anchor.x + r * Math.sin(phi) * Math.cos(theta);
      const y = anchor.y + r * Math.sin(phi) * Math.sin(theta);
      const z = anchor.z + r * Math.cos(phi);
      const pos = new THREE.Vector3(x, y, z);
      postPositions[gnode.id] = pos;
      sceneNodes.push({ id: gnode.id, type: "post", label: gnode.label, position: pos, color: isDark ? "#94a3b8" : "#475569", radius: 0.15 + (gnode.readingTime ?? 1) * 0.03, gnode });
    });
  }

  // Concept nodes — placed at centroid of linked posts
  const postToConcept: Map<string, string[]> = new Map();
  for (const l of graph.links) {
    if (l.type !== "concept") continue;
    const existing = postToConcept.get(l.source) ?? [];
    existing.push(l.target);
    postToConcept.set(l.source, existing);
  }

  const conceptPostMap: Map<string, string[]> = new Map();
  for (const [conceptId, postSlugs] of postToConcept) {
    for (const slug of postSlugs) {
      const existing = conceptPostMap.get(slug) ?? [];
      const cid = `concept-${conceptId.replace("concept-", "")}`;
      existing.push(cid);
      conceptPostMap.set(slug, existing);
    }
  }
  // Reverse: concept -> posts
  const conceptToPosts: Map<string, string[]> = new Map();
  for (const [cn, pids] of Object.entries(Object.fromEntries(postToConcept))) {
    for (const pid of pids) {
      const existing = conceptToPosts.get(`concept-${cn.replace("concept-", "")}`) ?? [];
      existing.push(`post-${pid.replace("post-", "")}`);
      conceptToPosts.set(`concept-${cn.replace("concept-", "")}`, existing);
    }
  }

  for (const gnode of graph.nodes) {
    if (gnode.type !== "concept") continue;
    const linkedPosts = conceptToPosts.get(gnode.id) ?? [];
    const positions = linkedPosts.map(pid => postPositions[pid]).filter(Boolean);
    if (positions.length === 0) continue;
    const centroid = new THREE.Vector3();
    positions.forEach(p => centroid.add(p));
    centroid.divideScalar(positions.length);
    centroid.x += (Math.random() - 0.5) * 0.5;
    centroid.y += (Math.random() - 0.5) * 0.5;
    centroid.z += (Math.random() - 0.5) * 0.5;
    conceptPositions[gnode.id] = centroid;
    sceneNodes.push({ id: gnode.id, type: "concept", label: gnode.label, position: centroid, color: CONCEPT_COLOR, radius: 0.2 + (gnode.docFreq ?? 1) * 0.04, gnode, linkedPostIds: linkedPosts });
  }

  // Filaments: concept -> post
  const filaments: SceneData["filaments"] = [];
  for (const l of graph.links) {
    if (l.type !== "concept") continue;
    const cid = `concept-${l.source.replace("concept-","")}`;
    const pid = `post-${l.target.replace("post-","")}`;
    const from = conceptPositions[cid];
    const to = postPositions[pid];
    if (from && to) filaments.push({ from, to, color: CONCEPT_COLOR, weight: Math.min(l.weight / 6, 1) });
  }

  return { nodes: sceneNodes, filaments };
}

// Seeded random
function mulberry32(a: number) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Galaxy3D({ graph }: { graph: GlobalGraph }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPost, setSelectedPost] = useState<GlobalNode | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [isDark, setIsDark] = useState(true);
  const sceneRef = useRef<{ controls: OrbitControls; camera: THREE.PerspectiveCamera; flyTarget: THREE.Vector3 | null } | null>(null);

  // Detect dark mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const sceneData = useMemo(() => buildSceneData(graph, isDark), [graph, isDark]);
  const nodeMap = useMemo(() => {
    const m = new Map<string, SceneNode>();
    for (const n of sceneData.nodes) m.set(n.id, n);
    return m;
  }, [sceneData]);

  // Three.js setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Label renderer
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(w, h);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0";
    labelRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(labelRenderer.domElement);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark ? BG_DARK : BG_LIGHT);
    scene.fog = new THREE.FogExp2(isDark ? FOG_DARK : FOG_LIGHT, 0.0008);

    // Camera
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 80);
    camera.position.set(8, 3, 14);
    camera.lookAt(0, 0, 0);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.minDistance = 3;
    controls.maxDistance = 30;
    controls.update();

    // Lighting
    scene.add(new THREE.AmbientLight(isDark ? 0x334155 : 0x94a3b8, 0.6));
    const dirLight = new THREE.DirectionalLight(isDark ? 0x818cf8 : 0x6366f1, 0.4);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    // Starfield
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 1500;
    const starVerts = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starVerts[i * 3] = (Math.random() - 0.5) * 30;
      starVerts[i * 3 + 1] = (Math.random() - 0.5) * 30;
      starVerts[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    starsGeo.setAttribute("position", new THREE.BufferAttribute(starVerts, 3));
    const starsMat = new THREE.PointsMaterial({ color: isDark ? STARFIELD_COLOR : "#64748b", size: 0.03, transparent: true, opacity: 0.6 });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // Helix strand
    const helixPoints: THREE.Vector3[] = [];
    const courseEntries = [...new Set(graph.nodes.filter(n => n.type === "course").map(n => n.label))].sort();
    for (const [cid, pos] of Object.entries(Object.fromEntries(courseEntries.map(c => [c, sceneData.nodes.find(n => n.id === `course-${c}`)?.position])))) {
      if (pos) helixPoints.push(pos);
    }
    if (helixPoints.length > 1) {
      const curve = new THREE.CatmullRomCurve3(helixPoints);
      const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.08, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({ color: isDark ? HELIX_COLOR : "#4f46e5", emissive: isDark ? "#312e81" : "#c7d2fe", emissiveIntensity: 0.4, roughness: 0.6, metalness: 0.3 });
      scene.add(new THREE.Mesh(tubeGeo, tubeMat));
    }

    // Meshes for nodes
    const meshes: THREE.Mesh[] = [];
    const labelObjects: CSS2DObject[] = [];
    const filamentLines: THREE.Line[] = [];
    const meshMap = new Map<string, THREE.Mesh>();

    const nodeGeo = new THREE.SphereGeometry(1, 16, 16);
    const ringGeo = new THREE.TorusGeometry(1, 0.08, 8, 16);

    for (const sn of sceneData.nodes) {
      const mat = new THREE.MeshStandardMaterial({
        color: sn.color,
        roughness: sn.type === "concept" ? 0.2 : sn.type === "course" ? 0.4 : 0.7,
        metalness: sn.type === "concept" ? 0.6 : 0.1,
        emissive: sn.type === "concept" ? CONCEPT_EMISSIVE : sn.type === "course" ? sn.color : POST_COLOR_EMISSIVE,
        emissiveIntensity: sn.type === "concept" ? 0.6 : 0.1,
      });
      const mesh = new THREE.Mesh(nodeGeo, mat);
      mesh.position.copy(sn.position);
      mesh.scale.setScalar(sn.radius);
      mesh.userData = { sceneNode: sn };
      scene.add(mesh);
      meshes.push(mesh);
      meshMap.set(sn.id, mesh);

      // Interactive ring for interactive posts
      if (sn.type === "post" && sn.gnode.interactive) {
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: INTERACTIVE_RING, emissive: INTERACTIVE_RING, emissiveIntensity: 0.5, roughness: 0.3 }));
        ring.position.copy(sn.position);
        ring.scale.setScalar(sn.radius * 1.8);
        ring.rotation.x = Math.PI / 2 + Math.random() * 0.5;
        ring.rotation.y = Math.random() * Math.PI;
        scene.add(ring);
        meshes.push(ring);
      }

      // Label for courses
      if (sn.type === "course") {
        const div = document.createElement("div");
        div.textContent = sn.label;
        div.style.cssText = `color:${isDark ? "#c4b5fd" : "#5b21b6"};font-size:13px;font-weight:700;text-shadow:0 0 8px rgba(124,58,237,0.5);pointer-events:none;white-space:nowrap;`;
        const label = new CSS2DObject(div);
        label.position.copy(sn.position).add(new THREE.Vector3(0, sn.radius + 0.5, 0));
        scene.add(label);
        labelObjects.push(label);
      }
    }

    // Filament lines
    for (const f of sceneData.filaments) {
      const geo = new THREE.BufferGeometry().setFromPoints([f.from, f.to]);
      const mat = new THREE.LineBasicMaterial({ color: f.color, transparent: true, opacity: 0.15 + f.weight * 0.25 });
      scene.add(new THREE.Line(geo, mat));
    }

    sceneRef.current = { controls, camera, flyTarget: null };

    // Raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.5;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshes);
      if (hits.length > 0) {
        const sn = hits[0].object.userData?.sceneNode as SceneNode | undefined;
        if (sn) {
          setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text: sn.type === "concept" ? `${sn.label}\n${sn.gnode.docFreq ?? "?"} posts` : sn.type === "course" ? sn.label : sn.label });
          container.style.cursor = "pointer";
        }
      } else {
        setTooltip(null);
        container.style.cursor = "grab";
      }
    };

    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshes);
      if (hits.length > 0) {
        const sn = hits[0].object.userData?.sceneNode as SceneNode | undefined;
        if (sn?.type === "post") setSelectedPost(sn.gnode);
        if (sn?.type === "course") {
          sceneRef.current!.flyTarget = sn.position.clone().add(new THREE.Vector3(0, 0, 3));
        }
      }
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("click", onClick);

    // Resize
    const onResize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
      labelRenderer.setSize(cw, ch);
    };
    window.addEventListener("resize", onResize);

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      // Fly-to animation
      if (sceneRef.current?.flyTarget) {
        const t = sceneRef.current.flyTarget;
        controls.target.lerp(t, 0.05);
        if (controls.target.distanceTo(t) < 0.1) sceneRef.current.flyTarget = null;
      }

      // Slowly rotate starfield
      stars.rotation.y += 0.0001;
      stars.rotation.x += 0.00005;

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      container.removeChild(labelRenderer.domElement);
    };
  }, [isDark, sceneData]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: "calc(100vh - 57px)" }}>
      {/* HUD */}
      <div className="absolute bottom-4 left-6 text-xs text-gray-400 dark:text-gray-500 pointer-events-none z-10">
        drag to orbit · scroll to zoom · click a star
      </div>

      {/* Legend chips */}
      <div className="absolute top-4 right-6 flex flex-wrap gap-2 max-w-[60%] justify-end z-10">
        {[...new Set(graph.nodes.filter(n => n.type === "course").map(n => n.label))].map(cid => (
          <button key={cid} onClick={() => {
            const sn = sceneData.nodes.find(n => n.id === `course-${cid}`);
            if (sn && sceneRef.current) sceneRef.current.flyTarget = sn.position.clone().add(new THREE.Vector3(0, 0, 3));
          }} className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all z-10">
            {cid}
          </button>
        ))}
      </div>

      {/* Detail panel */}
      {selectedPost && <DetailPanel node={selectedPost} onClose={() => setSelectedPost(null)} />}

      {/* Tooltip */}
      {tooltip && (
        <div className="absolute z-50 pointer-events-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 px-3 py-2 text-xs shadow-lg backdrop-blur-sm whitespace-pre-line max-w-[180px]" style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          {tooltip.text}
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slide-in 0.25s ease-out; }
      `}</style>
    </div>
  );
}
