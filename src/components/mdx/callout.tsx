import type { ReactNode } from "react";

const variants: Record<string, string> = {
  note: "border-l-[6px] border-l-blue-500 bg-gray-50 dark:bg-gray-800/60",
  tip: "border-l-[6px] border-l-green-500 bg-gray-50 dark:bg-gray-800/60",
  warning: "border-l-[6px] border-l-red-500 bg-gray-50 dark:bg-gray-800/60",
};

type Variant = "note" | "tip" | "warning";

export default function Callout({
  title = "Note",
  variant = "note" as Variant,
  className = "",
  children,
}: {
  title?: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  const v = variants[variant] ?? variants.note;
  return (
    <aside className={`rounded-2xl border border-gray-200 dark:border-gray-700 p-4 ${v} ${className}`}>
      <div className="font-bold mb-2">{title}</div>
      <div className="text-sm leading-relaxed">{children}</div>
    </aside>
  );
}
