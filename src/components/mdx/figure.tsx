const sizeMap: Record<string, string> = {
  xs: "max-w-xs mx-auto",
  sm: "max-w-sm mx-auto",
  md: "max-w-md mx-auto",
  lg: "max-w-2xl mx-auto",
  full: "w-full",
};

export default function Figure({
  src,
  alt,
  caption,
  size = "full",
  className = "",
}: {
  src: string;
  alt: string;
  caption?: string;
  size?: "xs" | "sm" | "md" | "lg" | "full";
  className?: string;
}) {
  return (
    <figure className={`my-8 ${sizeMap[size] ?? sizeMap.full} ${className}`}>
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="block w-full h-auto"
        />
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-sm italic text-gray-600 dark:text-gray-400 leading-relaxed px-4">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
