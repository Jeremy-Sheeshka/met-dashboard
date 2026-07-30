import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug, renderNative, getAdjacentPosts } from "@/lib/content";
import { renderPost, extractHeadings } from "@/lib/mdx";
import { TableOfContents } from "./toc";

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({
    courseId: post.course?.toLowerCase() ?? "uncategorized",
    slug: post.slug,
  }));
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ courseId: string; slug: string }>;
}) {
  const { courseId, slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const isNative = renderNative(post);
  const headings = extractHeadings(post.body);
  const { prev, next } = getAdjacentPosts(slug);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/courses/${courseId}`} className="hover:underline">
          {post.course ?? courseId}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-gray-100">{post.title}</span>
      </nav>

      <div className="flex gap-10">
        {/* Main content */}
        <article className="flex-1 min-w-0">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-3">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>{new Date(post.date).toLocaleDateString()}</span>
              <span>{post.readingTime} min read</span>
              {!isNative && (
                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 text-xs font-medium">
                  Interactive
                </span>
              )}
            </div>
            <p className="mt-4 text-gray-600 dark:text-gray-400 leading-relaxed">
              {post.description}
            </p>
          </header>

          {isNative ? (
            <PostBody body={post.body} url={post.url} />
          ) : (
            <>
              <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 text-sm text-gray-500 dark:text-gray-400">
                This post is rendered live from the blog.
              </div>
              <iframe
                src={`${post.url}?embed=1`}
                className="w-full border-0 rounded-xl"
                style={{ minHeight: "80vh" }}
                title={post.title}
                scrolling="yes"
              />
            </>
          )}

          {/* Post navigation */}
          <nav className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 flex justify-between gap-4">
            {prev && (
              <Link
                href={`/courses/${courseId}/${prev.slug}`}
                className="text-sm hover:underline text-gray-500 dark:text-gray-400"
              >
                ← {prev.title}
              </Link>
            )}
            <div className="flex-1" />
            {next && (
              <Link
                href={`/courses/${courseId}/${next.slug}`}
                className="text-sm hover:underline text-gray-500 dark:text-gray-400 text-right"
              >
                {next.title} →
              </Link>
            )}
          </nav>

          {/* Footer link */}
          <div className="mt-6 text-sm text-gray-400 dark:text-gray-500">
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              View original on the blog ↗
            </a>
          </div>
        </article>

        {/* Sidebar TOC (native posts only) */}
        {isNative && headings.length > 1 && (
          <TableOfContents headings={headings} />
        )}
      </div>
    </div>
  );
}

/** Wraps renderPost with a try/catch so one broken post never fails the build. */
async function PostBody({ body, url }: { body: string; url: string }) {
  try {
    return <div className="prose-wrapper">{await renderPost(body)}</div>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return (
      <div className="my-8 rounded-2xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-6">
        <p className="font-bold text-red-700 dark:text-red-400">
          This post could not be rendered natively.
        </p>
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">{message}</p>
        <p className="mt-2 text-sm">
          <a href={url} className="underline text-blue-600 dark:text-blue-400">
            View the original on the blog ↗
          </a>
        </p>
      </div>
    );
  }
}
