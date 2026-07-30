export interface Project {
  slug: string;
  name: string;
  description: string;
  screenshot: string;
  url: string;
  techStack: string[];
  date: string; // ISO 8601
}

/** Placeholder — populate with real MET projects as they're completed. */
export const projects: Project[] = [
  {
    slug: "math-champion",
    name: "Math Champion",
    description:
      "A smartboard math game aimed at elementary-aged students in classroom settings.",
    screenshot: "/projects/math-champion.png",
    url: "https://jeremysheeshka.ca/posts/2026-03-17-math-champion-game/",
    techStack: ["HTML", "CSS", "JavaScript", "Game Design"],
    date: "2026-03-17T00:00:00.000Z",
  },
];

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getAllTags(): string[] {
  return [...new Set(projects.flatMap((p) => p.techStack))].sort();
}

export function getProjectsByTag(tag: string): Project[] {
  return projects.filter((p) =>
    p.techStack.some((t) => t.toLowerCase() === tag.toLowerCase()),
  );
}
