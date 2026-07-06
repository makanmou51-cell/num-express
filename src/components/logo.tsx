import { cn } from "@/lib/utils";
import { BrandIcon } from "@/components/brand-icon";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold", className)}>
      <BrandIcon className="h-8 w-8 rounded-lg" />
      <span className="text-xl tracking-tight">
        num<span className="text-primary"> express</span>
      </span>
    </span>
  );
}
