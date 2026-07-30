import Link from "next/link";
import { getAllPosts, getAllCourses } from "@/lib/content";

export default function HomePage() {
  const posts = getAllPosts();
  const courses = getAllCourses();
  const scriptedCount = posts.filter((p) => p.interactive).length;
  const earliest = posts[posts.length - 1];
  const latest = posts[0];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Hero stats */}
      <section className="mb-16">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          MET Learning Dashboard
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
          A complete archive of my Master of Educational Technology journey —
          {posts.length} posts across {courses.length} courses, from{" "}
          {earliest?.title} to {latest?.title}.
        </p>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard value={posts.length} label="Posts" />
          <StatCard value={courses.length} label="Courses" />
          <StatCard value={posts.length - scriptedCount} label="Essays & Papers" />
          <StatCard value={scriptedCount} label="Interactive" />
        </div>
      </section>

      {/* D3 journey timeline placeholder */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-4">Learning Journey</h2>
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
          D3 timeline visualization — coming soon
        </div>
      </section>

      {/* Course navigation */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Courses</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((courseId) => {
            const coursePosts = posts.filter(
              (p) => p.course?.toLowerCase() === courseId.toLowerCase(),
            );
            return (
              <Link
                key={courseId}
                href={`/courses/${courseId.toLowerCase()}`}
                className="block rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:border-gray-400 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-900"
              >
                <h3 className="font-bold text-lg mb-1">{courseId}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {coursePosts.length} post{coursePosts.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 truncate">
                  {coursePosts[0]?.title}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-center">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
  );
}
