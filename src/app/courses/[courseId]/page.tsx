import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostsByCourse, getAllCourses, renderNative } from "@/lib/content";
import { getCourseConceptGraph } from "@/lib/concepts";
import ConceptMap from "@/components/ConceptMap";

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
  const conceptGraph = getCourseConceptGraph(courseId);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link
        href="/courses"
        className="text-sm text-gray-500 dark:text-gray-400 hover:underline mb-4 inline-block"
      >
        ← All Courses
      </Link>
      <h1 className="text-3xl font-bold mb-2">{courseLabel}</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        {posts.length} post{posts.length !== 1 ? "s" : ""}
      </p>

      {/* D3 concept map */}
      {conceptGraph ? (
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-3 text-gray-500 dark:text-gray-400">
            Knowledge Web
          </h2>
          <ConceptMap graph={conceptGraph} />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-center h-32 mb-10 text-sm text-gray-400 dark:text-gray-500">
          Not enough posts to map concepts yet.
        </div>
      )}

      {/* Post cards */}
      <div className="space-y-4">
        {posts.map((post) => {
          const isNative = renderNative(post);
          return (
            <Link
              key={post.slug}
              href={`/courses/${courseId}/${post.slug}`}
              className="block rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-gray-400 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg leading-snug mb-1">
                    {post.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {post.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isNative && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 text-xs font-medium">
                      Interactive
                    </span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {post.readingTime} min
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
