import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/mdx";
import type { ReactNode } from "react";

/**
 * Compile raw MDX body to React nodes using next-mdx-remote/rsc.
 * Wraps compilation in try/catch — a broken post renders a fallback
 * box linking to the original rather than failing the build.
 */
export async function renderPost(body: string): Promise<ReactNode> {
  try {
    return (
      <MDXRemote
        source={body}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
          },
        }}
        components={mdxComponents}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return (
      <div className="my-8 rounded-2xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-6">
        <p className="font-bold text-red-700 dark:text-red-400">
          This post could not be rendered natively.
        </p>
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
          {message}
        </p>
        <p className="mt-2 text-sm">
          <a
            href="#"
            className="underline text-blue-600 dark:text-blue-400"
          >
            View the original on the blog
          </a>
        </p>
      </div>
    );
  }
}

/**
 * Parse headings (## and ###) from raw MDX body with slugified anchors.
 * Returns [{ level, text, slug }] for table-of-contents use.
 */
export function extractHeadings(
  body: string,
): { level: number; text: string; slug: string }[] {
  const headingRe = /^(#{2,3})\s+(.+)$/gm;
  const headings: { level: number; text: string; slug: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(body)) !== null) {
    const level = m[1].length;
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    const slug = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    headings.push({ level, text, slug });
  }
  return headings;
}
