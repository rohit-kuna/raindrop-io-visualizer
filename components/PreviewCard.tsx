import type { PositionedRaindrop } from "@/lib/types";

type PreviewCardProps = {
  raindrop: PositionedRaindrop;
  x: number;
  y: number;
};

export function PreviewCard({ raindrop, x, y }: PreviewCardProps) {
  const date = new Date(raindrop.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="pointer-events-none fixed z-50 w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
      style={{ left: x + 16, top: y + 16 }}
    >
      <div className="flex items-start gap-2">
        {raindrop.domain ? (
          <img
            src={`https://www.google.com/s2/favicons?domain=${raindrop.domain}&sz=32`}
            alt=""
            className="mt-0.5 size-4 shrink-0 rounded-sm"
          />
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{raindrop.title}</p>
          {raindrop.domain ? (
            <p className="truncate text-xs text-muted-foreground">{raindrop.domain}</p>
          ) : null}
        </div>
      </div>
      {raindrop.excerpt ? (
        <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{raindrop.excerpt}</p>
      ) : null}
      <p className="mt-2 text-[11px] text-muted-foreground">{date}</p>
    </div>
  );
}
