import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostsByCourse, getAllCourses } from "@/lib/content";

export async function generateStaticParams() {
  return getAllCourses().map((courseId) => ({
    courseId: courseId.toLowerCase(),
  }));
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const posts = getPostsByCourse(courseId);
  if (posts.length === 0) notFound();

  const courseLabel = posts[0]?.course ?? courseId.toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-2">{courseLabel}</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        {posts.length} post{posts.length !== 1 ? "s" : ""}
      </p>

      {/* Explore in galaxy */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 mb-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Explore {courseLabel} in the knowledge graph.
        </p>
        <Link
          href={`/?course=${courseId.toLowerCase()}`}
          className="inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-4 py-1.5 text-sm font-medium hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
        >
          Open in Galaxy →
        </Link>
      </div>

      {/* Post list (compact, for SEO + direct nav) */}
      <div className="space-y-2">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/courses/${courseId}/${post.slug}`}
            className="block rounded-lg border border-gray-100 dark:border-gray-800 px-4 py-3 hover:border-gray-300 dark:hover:border-gray-700 transition-colors bg-white dark:bg-gray-900"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium truncate">{post.title}</span>
              <span className="text-xs text-gray-400 shrink-0">{post.readingTime}m</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
