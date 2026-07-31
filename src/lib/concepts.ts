// ---------------------------------------------------------------------------
// Build-time concept extraction — reads posts.json, produces a bipartite
// concept↔post graph for force-directed D3 visualization on course pages.
// ---------------------------------------------------------------------------

import { getAllPosts } from "@/lib/content";
import type { Post } from "@/lib/content";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConceptNode {
  id: string;
  label: string;
  docFreq: number;
  totalFreq: number;
}

export interface PostNode {
  slug: string;
  title: string;
  course: string;
  readingTime: number;
}

export interface ConceptLink {
  concept: string;
  postSlug: string;
  weight: number;
}

export interface ConceptGraph {
  concepts: ConceptNode[];
  posts: PostNode[];
  links: ConceptLink[];
}

// ---------------------------------------------------------------------------
// Stopwords — extended for academic/ETEC context
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  // Standard English
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
  "have", "he", "her", "his", "i", "in", "is", "it", "its", "of", "on",
  "or", "that", "the", "to", "was", "were", "will", "with", "this",
  "these", "those", "there", "here", "you", "your", "we", "our", "they",
  "them", "my", "me", "us", "not", "no", "nor", "so", "if", "then",
  "than", "too", "very", "can", "just", "should", "would", "could",
  "may", "might", "must", "do", "does", "did", "doing", "done", "being",
  "been", "am", "about", "into", "through", "during", "before", "after",
  "above", "below", "between", "out", "off", "over", "under", "again",
  "further", "once", "also", "each", "both", "few", "more", "most",
  "other", "some", "such", "only", "own", "same", "s", "t", "don",
  "didn", "doesn", "isn", "aren", "wasn", "weren", "won", "wouldn",
  "shouldn", "couldn", "how", "what", "which", "when", "where", "why",
  "who", "whom", "whose", "way", "ways", "thing", "things", "really",
  "actually", "basically", "essentially", "however", "therefore", "thus",
  "even", "still", "yet", "around", "toward", "towards", "within",
  "without", "per", "via", "eg", "ie", "etc", "able",
  // Web/tech noise
  "week", "weeks", "post", "posts", "read", "reading", "reads", "page",
  "pages", "figure", "fig", "img", "src", "http", "https", "www", "com",
  "org", "net", "jpg", "png", "svg", "gif", "md", "mdx", "import",
  "export", "const", "let", "var", "class", "classname", "div", "span",
  "href", "alt", "title", "px", "rem", "em", "font", "color",
  // Academic/ETEC
  "etec", "ip", "assignment", "assignments", "reflection", "reflections",
  "response", "responses", "discussion", "board", "course", "program",
  "university", "ubc", "okanagan", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten", "first", "second", "third",
  "new", "use", "used", "using", "make", "made", "many", "much", "get",
  "got", "go", "goes", "going", "like", "well", "know", "think",
  "need", "also", "see", "work", "working", "works", "part", "based",
  "different", "important", "example", "including", "however", "within",
  "often", "provide", "provides", "provided", "order", "understanding",
  "understand", "develop", "development", "process", "processes",
  // Extra noise from extraction
  "references", "reference", "had", "but", "while", "their", "all",
  "always", "something", "time", "real", "back", "because", "every",
  "now", "since", "still", "those", "through", "what", "where",
  "which", "who", "year", "years", "found", "find", "found", "long",
  "right", "left", "top", "bottom", "next", "previous", "last",
  "note", "notes", "words", "word", "text", "students", "student",
  "teacher", "teachers", "teaching", "teach", "education", "learning",
  "due", "set", "help", "key", "form", "asked", "ask", "asks",
  "hands", "low", "self", "worth", "select", "specific",
]);

// Course-code tokens to suppress (e.g. "etec544")
function courseCodeTokens(courseId: string): Set<string> {
  const s = new Set<string>();
  s.add(courseId.toLowerCase());
  s.add(courseId.toLowerCase().replace(/^etec/, ""));
  return s;
}

// ---------------------------------------------------------------------------
// Text cleaning
// ---------------------------------------------------------------------------

function stripMarkdown(text: string): string {
  return text
    // Remove frontmatter
    .replace(/^---[\s\S]*?---/m, "")
    // Remove import/export lines
    .replace(/^import\s+.*$/gm, "")
    .replace(/^export\s+.*$/gm, "")
    // Remove URLs
    .replace(/https?:\/\/\S+/g, " ")
    // Remove HTML/JSX tags
    .replace(/<[^>]+>/g, " ")
    // Remove markdown syntax
    .replace(/[#*`~\[\]|>!_\-\\.:\\/@]/g, " ")
    // Remove numbers and punctuation
    .replace(/[0-9]/g, "")
    // Collapse whitespace, lowercase
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((t) => t.replace(/^[^a-z]+|[^a-z]+$/g, "")) // strip leading/trailing non-letters
    .filter((t) => t.length >= 3)
    .filter((t) => /[a-z]/.test(t));
}

// ---------------------------------------------------------------------------
// Graph extraction
// ---------------------------------------------------------------------------

/**
 * Build a concept graph for a course. Returns null if <2 posts or <2 concepts.
 */
export function getCourseConceptGraph(courseId: string): ConceptGraph | null {
  const posts = getAllPosts().filter(
    (p) => p.course?.toLowerCase() === courseId.toLowerCase(),
  );
  if (posts.length < 2) return null;

  const suppress = courseCodeTokens(courseId);

  // Per-post token sets
  const postTokens: Map<string, Set<string>> = new Map();
  const postFreqs: Map<string, Map<string, number>> = new Map();

  for (const post of posts) {
    const text = stripMarkdown(post.body || `${post.description} ${post.excerpt}`);
    const tokens = tokenize(text).filter(
      (t) => !STOPWORDS.has(t) && !suppress.has(t),
    );
    const tokenSet = new Set(tokens);
    postTokens.set(post.slug, tokenSet);

    const freq = new Map<string, number>();
    for (const t of tokens) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    postFreqs.set(post.slug, freq);
  }

  // Find concepts: terms appearing in >=2 posts
  const dfMap = new Map<string, number>(); // document frequency
  const tfMap = new Map<string, number>(); // total term frequency
  for (const tokenSet of postTokens.values()) {
    for (const t of tokenSet) {
      dfMap.set(t, (dfMap.get(t) ?? 0) + 1);
    }
  }
  for (const freq of postFreqs.values()) {
    for (const [t, f] of freq) {
      tfMap.set(t, (tfMap.get(t) ?? 0) + f);
    }
  }

  // Filter: must appear in >=2 posts
  const candidates = [...dfMap.entries()]
    .filter(([, df]) => df >= 2)
    .sort((a, b) => b[1] - a[1] || (tfMap.get(b[0]) ?? 0) - (tfMap.get(a[0]) ?? 0))
    .slice(0, 12);

  if (candidates.length < 2) return null;

  const N = posts.length;
  const concepts: ConceptNode[] = candidates.map(([term, df]) => ({
    id: term,
    label: term,
    docFreq: df,
    totalFreq: tfMap.get(term) ?? 0,
  }));

  const conceptSet = new Set(candidates.map(([t]) => t));

  // Build links with TF-IDF
  const links: ConceptLink[] = [];
  for (const post of posts) {
    const freqs = postFreqs.get(post.slug)!;
    for (const concept of conceptSet) {
      const tf = freqs.get(concept) ?? 0;
      if (tf === 0) continue;
      const df = dfMap.get(concept) ?? 1;
      const idf = Math.log((1 + N) / (1 + df)) + 1;
      const weight = tf * idf;
      links.push({ concept, postSlug: post.slug, weight });
    }
  }

  const postNodes: PostNode[] = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    course: p.course ?? courseId,
    readingTime: p.readingTime,
  }));

  return { concepts, posts: postNodes, links };
}

// ---------------------------------------------------------------------------
// Global graph — unions all courses, posts, and concepts into one galaxy
// ---------------------------------------------------------------------------

export interface GlobalNode {
  id: string;
  type: "course" | "post" | "concept";
  label: string;
  // post fields
  slug?: string;
  title?: string;
  course?: string;
  readingTime?: number;
  interactive?: boolean;
  excerpt?: string;
  date?: string;
  url?: string;
  // concept fields
  docFreq?: number;
  totalFreq?: number;
  // course fields
  postCount?: number;
}

export interface GlobalLink {
  source: string;
  target: string;
  type: "membership" | "concept";
  weight: number;
}

export interface GlobalGraph {
  nodes: GlobalNode[];
  links: GlobalLink[];
}

export function getGlobalGraph(): GlobalGraph {
  const allPosts = getAllPosts();
  const courses = [...new Set(allPosts.map((p) => p.course).filter(Boolean))] as string[];

  const nodes: GlobalNode[] = [];
  const links: GlobalLink[] = [];
  const conceptIds = new Set<string>();

  // Course nodes
  for (const courseId of courses) {
    const coursePosts = allPosts.filter((p) => p.course === courseId);
    nodes.push({
      id: `course-${courseId}`,
      type: "course",
      label: courseId,
      postCount: coursePosts.length,
    });

    // Post nodes + membership links
    for (const post of coursePosts) {
      nodes.push({
        id: `post-${post.slug}`,
        type: "post",
        label: post.title.length > 45 ? post.title.slice(0, 42) + "…" : post.title,
        slug: post.slug,
        title: post.title,
        course: courseId,
        readingTime: post.readingTime,
        interactive: post.interactive,
        excerpt: post.excerpt,
        date: post.date,
        url: post.url,
      });
      links.push({
        source: `course-${courseId}`,
        target: `post-${post.slug}`,
        type: "membership",
        weight: 0.5,
      });
    }

    // Concept nodes + links (from per-course extraction)
    const cg = getCourseConceptGraph(courseId);
    if (!cg) continue;

    for (const c of cg.concepts) {
      const gid = `concept-${c.id}`;
      if (!conceptIds.has(gid)) {
        conceptIds.add(gid);
        nodes.push({
          id: gid,
          type: "concept",
          label: c.label,
          docFreq: c.docFreq,
          totalFreq: c.totalFreq,
        });
      }
    }
    for (const l of cg.links) {
      links.push({
        source: `concept-${l.concept}`,
        target: `post-${l.postSlug}`,
        type: "concept",
        weight: l.weight,
      });
    }
  }

  return { nodes, links };
}
