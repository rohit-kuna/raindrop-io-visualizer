import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GraphTag } from "@/lib/types";

type SearchFilterProps = {
  tags: GraphTag[];
  matchingTagIds: Set<number> | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  activeTagIds: Set<number>;
  onToggleTagFilter: (tagId: number) => void;
  onClearTagFilters: () => void;
  onClose?: () => void;
  onCollapse?: () => void;
};

export function SearchFilter({
  tags,
  matchingTagIds,
  searchQuery,
  onSearchQueryChange,
  activeTagIds,
  onToggleTagFilter,
  onClearTagFilters,
  onClose,
  onCollapse,
}: SearchFilterProps) {
  const sortedTags = tags
    .filter((tag) => matchingTagIds === null || matchingTagIds.has(tag.id))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="scrollbar-thin flex h-full w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r bg-background p-4">
      <div className="-mr-2 flex items-center gap-2 md:hidden">
        <span className="text-sm font-medium">Filters</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={onClose}
          aria-label="Close tags panel"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="-mr-2 flex items-center gap-2">
        <Input
          placeholder="Search titles, excerpts..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
        />
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse tags panel"
          className="hidden size-9 shrink-0 items-center justify-center rounded-md border bg-background/80 shadow-sm backdrop-blur hover:bg-accent md:flex"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Tags</span>
          {activeTagIds.size > 0 ? (
            <Button variant="ghost" size="xs" onClick={onClearTagFilters}>
              Clear
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sortedTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => onToggleTagFilter(tag.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                activeTagIds.has(tag.id)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-accent"
              )}
            >
              {tag.name} <span className="opacity-60">{tag.count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
