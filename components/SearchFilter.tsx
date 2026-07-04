import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GraphTag } from "@/lib/types";

type SearchFilterProps = {
  tags: GraphTag[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  activeTagIds: Set<number>;
  onToggleTagFilter: (tagId: number) => void;
  onClearTagFilters: () => void;
};

export function SearchFilter({
  tags,
  searchQuery,
  onSearchQueryChange,
  activeTagIds,
  onToggleTagFilter,
  onClearTagFilters,
}: SearchFilterProps) {
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);

  return (
    <div className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r p-4">
      <Input
        placeholder="Search titles, excerpts..."
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
      />

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
