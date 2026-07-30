import type { ReactNode } from "react";

export default function Aside({
  title = "Aside",
  className = "",
  children,
}: {
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <aside className={`my-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/20 dark:bg-gray-800/20 p-5 ${className}`}>
      <div className="font-semibold mb-2">{title}</div>
      <div className="text-sm leading-relaxed">{children}</div>
    </aside>
  );
}
