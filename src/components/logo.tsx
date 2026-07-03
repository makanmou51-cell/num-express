import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        {/* icône téléphone/éclair */}
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
      </span>
      <span className="text-xl tracking-tight">
        num<span className="text-primary"> express</span>
      </span>
    </span>
  );
}
