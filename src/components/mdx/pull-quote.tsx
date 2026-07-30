import type { ReactNode } from "react";

export default function PullQuote({
  cite,
  children,
}: {
  cite?: string;
  children: ReactNode;
}) {
  return (
    <figure className="my-8 border-y-2 border-black/10 py-6 text-center dark:border-white/10">
      <blockquote className="text-2xl font-serif italic leading-relaxed text-gray-900 dark:text-gray-100">
        “{children}”
      </blockquote>
      {cite && (
        <figcaption className="mt-4 text-sm font-medium uppercase tracking-widest opacity-60">
          — {cite}
        </figcaption>
      )}
    </figure>
  );
}
