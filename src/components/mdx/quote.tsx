import type { ReactNode } from "react";

export default function Quote({
  cite,
  className = "",
  children,
}: {
  cite?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className={`my-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 ${className}`}>
      <blockquote className="text-base italic leading-relaxed">
        {children}
      </blockquote>
      {cite && (
        <figcaption className="mt-3 text-sm opacity-80">— {cite}</figcaption>
      )}
    </figure>
  );
}
