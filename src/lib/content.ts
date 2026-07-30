// ---------------------------------------------------------------------------
// Post type — matches the shape emitted by /posts.json on the blog.
// ---------------------------------------------------------------------------

export interface Post {
  slug: string;
  title: string;
  date: string; // ISO 8601
  description: string;
  course: string | null;
  tags: string[];
  url: string;
  excerpt: string;
  body: string;
  readingTime: number;
  interactive: boolean;
  componentImports: string[];
}

// Lightweight search projection (no body).
export interface SearchEntry {
  slug: string;
  title: string;
  description: string;
  course: string | null;
  tags: string[];
  excerpt: string;
  url: string;
  readingTime: number;
  interactive: boolean;
}

// ---------------------------------------------------------------------------
// Porting policy — which Astro components have React ports.
//
// PRESSURE VALVE: set to new Set() to make every post renderNative===false
// (the entire archive iframes with zero ports — the fast-ship fallback).
//
// Tier-1 is always ported. Tier-2 will be finalized after the frequency
// table in Step 4. Tier-3 (IP6Interactive, SurvivanceGame, DiaryBoard,
// Timeline, and any bespoke one-offs) are never ported.
// ---------------------------------------------------------------------------

export const PORTED_COMPONENTS: Set<string> = new Set([
  // Tier-1 (always)
  "Prose",
  "Figure",
  "Callout",
  "Note",
  "Aside",
  "Quote",
  "PullQuote",
  "Badge",
  "Card",
  "Cite",
  "Definition",
  "Step",
  "Steps",
]);

/**
 * A post can be rendered natively (via MDX) when it contains no <script>
 * tags AND all of its Astro-component imports have React ports available.
 */
export function renderNative(post: Post): boolean {
  if (post.interactive) return false;
  return post.componentImports.every((c) => PORTED_COMPONENTS.has(c));
}

// ---------------------------------------------------------------------------
// Data access — reads from the cached posts.json at build time.
// ---------------------------------------------------------------------------

let _posts: Post[] | null = null;

function loadPosts(): Post[] {
  if (_posts) return _posts;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _posts = require("@/data/posts.json") as Post[];
  return _posts!;
}

export function getAllPosts(): Post[] {
  return loadPosts();
}

export function getPostsByCourse(courseId: string): Post[] {
  return loadPosts().filter(
    (p) => p.course?.toLowerCase() === courseId.toLowerCase(),
  );
}

export function getPostBySlug(slug: string): Post | undefined {
  return loadPosts().find((p) => p.slug === slug);
}

export function getAllCourses(): string[] {
  const courses = new Set(
    loadPosts()
      .map((p) => p.course)
      .filter((c): c is string => c !== null),
  );
  return [...courses].sort();
}

/** Return prev/next posts within the same course for navigation. */
export function getAdjacentPosts(
  slug: string,
): { prev: Post | null; next: Post | null } {
  const posts = loadPosts();
  const idx = posts.findIndex((p) => p.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx < posts.length - 1 ? posts[idx + 1] : null,
    next: idx > 0 ? posts[idx - 1] : null,
  };
}
