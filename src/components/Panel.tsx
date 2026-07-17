export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border-4 border-ro-panel-border bg-ro-panel shadow-lg ${className ?? ""}`}
    >
      {title && (
        <div className="border-b-4 border-ro-panel-border bg-ro-panel-header px-4 py-2">
          <h2 className="font-heading text-xs tracking-wide text-ro-gold">
            {title}
          </h2>
        </div>
      )}
      <div className="p-4 text-ro-text">{children}</div>
    </div>
  );
}
