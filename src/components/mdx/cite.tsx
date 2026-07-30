export default function Cite({
  n,
  title,
}: {
  n: number;
  title?: string;
}) {
  const citeId = `cite-${n}`;
  const refId = `ref-${n}`;
  return (
    <span id={citeId} className="inline-flex align-super scroll-mt-24">
      <a
        href={`#${refId}`}
        className="text-xs font-mono text-blue-600 hover:underline ml-1"
        title={title}
        aria-label={title ? `Jump to reference ${n}: ${title}` : `Jump to reference ${n}`}
      >
        [{n}]
      </a>
    </span>
  );
}
