import type { ReactNode } from "react";

export default function Step({
  title,
  description,
  icon,
  className = "",
  children,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li className={className}>
      <div className="flex flex-row">
        <div className="flex flex-col items-center mr-4 rtl:mr-0 rtl:ml-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-blue-500 bg-blue-500 dark:bg-blue-700 text-gray-50 dark:text-gray-100 font-bold">
            {icon}
          </div>
          <div className="w-px h-full bg-gray-300 dark:bg-gray-500 my-2" />
        </div>
        <div className="pt-1 pb-8">
          {title && (
            <h3 className="text-xl font-bold text-gray-900 dark:text-slate-300 mb-2">
              {title}
            </h3>
          )}
          <div className="text-gray-600 dark:text-slate-400">{children}</div>
        </div>
      </div>
    </li>
  );
}
