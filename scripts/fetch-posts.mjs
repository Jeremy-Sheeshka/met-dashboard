#!/usr/bin/env node
/**
 * Fetch the blog's post archive and write two cache files:
 *   src/data/posts.json     — full payload (server-only)
 *   public/search-index.json — light projection (no body)
 *
 * Usage:  node scripts/fetch-posts.mjs
 * Wired as:  npm run sync:posts   and   prebuild
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const POSTS_URL = "https://jeremysheeshka.ca/posts.json";
const POSTS_PATH = join(ROOT, "src", "data", "posts.json");
const SEARCH_PATH = join(ROOT, "public", "search-index.json");

const STALE_DAYS = 7;

// ---------------------------------------------------------------------------
async function main() {
  let data;
  try {
    const res = await fetch(POSTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.warn(`⚠ fetch-posts: could not fetch ${POSTS_URL} — ${err.message}`);

    // Stale guard: if cache is older than STALE_DAYS, fail loudly
    if (existsSync(POSTS_PATH)) {
      const ageDays =
        (Date.now() - readFileSync(POSTS_PATH).mtimeMs) / 86_400_000;
      if (ageDays > STALE_DAYS) {
        console.error(
          `❌ fetch-posts: cache is ${ageDays.toFixed(1)} days old (>${STALE_DAYS}d). ` +
            `Exiting to prevent a silently stale build.`,
        );
        process.exit(1);
      }
      console.warn(`⚠ fetch-posts: using cached data (${ageDays.toFixed(1)}d old)`);
    } else {
      console.error("❌ fetch-posts: no cache and fetch failed — exiting");
      process.exit(1);
    }
    return;
  }

  // Full payload
  mkdirSync(dirname(POSTS_PATH), { recursive: true });
  writeFileSync(POSTS_PATH, JSON.stringify(data, null, 2));
  console.log(`✓ wrote ${data.length} posts → ${POSTS_PATH}`);

  // Light search projection (no body)
  const searchIndex = data.map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    course: p.course,
    tags: p.tags,
    excerpt: p.excerpt,
    url: p.url,
    readingTime: p.readingTime,
    interactive: p.interactive,
  }));
  mkdirSync(dirname(SEARCH_PATH), { recursive: true });
  writeFileSync(SEARCH_PATH, JSON.stringify(searchIndex));
  console.log(`✓ wrote search index → ${SEARCH_PATH}`);
}

main();
