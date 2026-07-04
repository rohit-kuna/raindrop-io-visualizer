"use client";

export type ViewMode = "network" | "solar";

const OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "network", label: "Tag Network" },
  { value: "solar", label: "Solar System" },
];

export function ViewSwitcher({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const activeIndex = OPTIONS.findIndex((o) => o.value === view);

  return (
    <div className="relative inline-flex items-center rounded-full border border-border bg-background/80 p-1 shadow-sm backdrop-blur">
      <span
        className="absolute inset-y-1 rounded-full bg-foreground transition-transform duration-300 ease-out"
        style={{
          width: `calc(${100 / OPTIONS.length}% - 4px)`,
          transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 4}px))`,
        }}
        aria-hidden
      />
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`relative z-10 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-300 ${
            view === option.value
              ? "text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={view === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
