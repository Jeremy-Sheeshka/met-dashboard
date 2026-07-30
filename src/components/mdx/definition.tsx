import type { ReactNode } from "react";

export default function Definition({
  term,
  className = "",
  children,
}: {
  term: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`my-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30 p-5 ${className}`}>
      <div className="font-bold">{term}</div>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
