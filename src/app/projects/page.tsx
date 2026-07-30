import Link from "next/link";
import { projects, getAllTags } from "@/data/projects";

export default function ProjectsPage() {
  const tags = getAllTags();

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-8">Projects</h1>

      {/* Tag filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1 text-xs font-medium">
          All
        </span>
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-3 py-1 text-xs font-medium"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Project grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link
            key={project.slug}
            href={`/projects/${project.slug}`}
            className="block rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:border-gray-400 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-900"
          >
            <div className="h-48 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
              {project.name}
            </div>
            <div className="p-5">
              <h2 className="font-bold text-lg mb-1">{project.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                {project.description}
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                {project.techStack.map((tech) => (
                  <span
                    key={tech}
                    className="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
