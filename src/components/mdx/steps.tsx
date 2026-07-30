import type { ReactNode } from "react";

export default function Steps({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="my-8">
      {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
      <ol className="space-y-4 list-decimal list-inside marker:font-bold marker:text-xl marker:text-blue-600 dark:marker:text-blue-400">
        {children}
      </ol>
    </div>
  );
}
