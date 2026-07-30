import type { ReactNode } from "react";

export default function Prose({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`prose max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-a:underline prose-a:underline-offset-4 ${className}`}
    >
      {children}
    </div>
  );
}
