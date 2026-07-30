import type { ReactNode } from "react";

export default function Note({
  title,
  className = "",
  children,
}: {
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`my-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30 p-5 ${className}`}>
      {title && <div className="font-semibold mb-2">{title}</div>}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
