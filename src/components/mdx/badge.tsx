import type { ReactNode } from "react";

const variants: Record<string, string> = {
  default: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  accent: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  outline: "bg-transparent text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700",
};

export default function Badge({
  variant = "default",
  className = "",
  children,
}: {
  variant?: "default" | "accent" | "outline";
  className?: string;
  children: ReactNode;
}) {
  const v = variants[variant] ?? variants.default;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${v} ${className}`}>
      {children}
    </span>
  );
}
