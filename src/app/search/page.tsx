"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Fuse from "fuse.js";
import Link from "next/link";

interface SearchEntry {
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

export default function SearchPage() {
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load search index on mount
  useEffect(() => {
    fetch("/search-index.json")
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => {});
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(entries, {
        keys: [
          { name: "title", weight: 0.4 },
          { name: "description", weight: 0.2 },
          { name: "excerpt", weight: 0.2 },
          { name: "tags", weight: 0.1 },
          { name: "course", weight: 0.1 },
        ],
        threshold: 0.4,
        includeScore: true,
      }),
    [entries],
  );

  const results = useMemo(() => {
    if (!query.trim() || entries.length === 0) return [];
    return fuse.search(query).map((r) => r.item);
  }, [query, fuse, entries]);

  // Group by course
  const grouped = useMemo(() => {
    const groups: Record<string, SearchEntry[]> = {};
    for (const r of results) {
      const course = r.course ?? "Other";
      if (!groups[course]) groups[course] = [];
      groups[course].push(r);
    }
    return groups;
  }, [results]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIdx]) {
        const r = results[selectedIdx];
        window.location.href = `/courses/${(r.course ?? "other").toLowerCase()}/${r.slug}`;
      } else if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [results, selectedIdx]);

  // Reset selection when results change
  useEffect(() => setSelectedIdx(0), [query]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Search</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        Press <kbd className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-xs font-mono">/</kbd> to focus
      </p>

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search posts..."
        className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        autoFocus
      />

      {query.trim() && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {results.length} result{results.length !== 1 ? "s" : ""}
        </p>
      )}

      <div ref={resultsRef} className="mt-6 space-y-8">
        {Object.entries(grouped).map(([course, posts]) => (
          <section key={course}>
            <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              {course}
            </h2>
            <div className="space-y-3">
              {posts.map((post, i) => {
                const globalIdx = results.indexOf(post);
                const isSelected = globalIdx === selectedIdx;
                return (
                  <Link
                    key={post.slug}
                    href={`/courses/${(post.course ?? "other").toLowerCase()}/${post.slug}`}
                    className={`block rounded-xl border p-4 transition-colors ${
                      isSelected
                        ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold">{post.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {post.description}
                        </p>
                        {post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {post.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {post.interactive && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                            Interactive
                          </span>
                        )}
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {post.readingTime}m
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
