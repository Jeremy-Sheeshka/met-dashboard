import Link from "next/link";
import { notFound } from "next/navigation";
import { projects, getProjectBySlug } from "@/data/projects";

export async function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link
        href="/projects"
        className="text-sm text-gray-500 dark:text-gray-400 hover:underline mb-4 inline-block"
      >
        ← All Projects
      </Link>
      <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        {project.description}
      </p>
      <div className="flex flex-wrap gap-2 mb-8">
        {project.techStack.map((tech) => (
          <span
            key={tech}
            className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400"
          >
            {tech}
          </span>
        ))}
      </div>

      {/* Embed the project if it has a URL */}
      {project.url && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <iframe
            src={project.url}
            className="w-full border-0"
            style={{ minHeight: "80vh" }}
            title={project.name}
            scrolling="yes"
          />
        </div>
      )}

      <div className="mt-6 text-sm text-gray-400 dark:text-gray-500">
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          View original ↗
        </a>
      </div>
    </div>
  );
}
