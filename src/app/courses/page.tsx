import Link from "next/link";
import { getAllPosts, getAllCourses } from "@/lib/content";

export default function CoursesPage() {
  const courses = getAllCourses();
  const posts = getAllPosts();

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-8">All Courses</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((courseId) => {
          const coursePosts = posts.filter(
            (p) => p.course?.toLowerCase() === courseId.toLowerCase(),
          );
          const latest = coursePosts[0];
          return (
            <Link
              key={courseId}
              href={`/courses/${courseId.toLowerCase()}`}
              className="block rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:border-gray-400 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-900"
            >
              <h2 className="font-bold text-xl mb-2">{courseId}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {coursePosts.length} post{coursePosts.length !== 1 ? "s" : ""}
              </p>
              {latest && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                  Latest: {latest.title}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
