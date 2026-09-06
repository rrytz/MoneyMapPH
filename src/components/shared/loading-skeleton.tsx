import { Skeleton } from "@/components/ui/skeleton";
import { FintechCard, FintechCardContent, FintechCardHeader } from "@/components/ui/fintech-card";

export function KpiSkeleton() {
  return (
    <FintechCard>
      <FintechCardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </FintechCardHeader>
      <FintechCardContent>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </FintechCardContent>
    </FintechCard>
  );
}

export function ChartSkeleton() {
  return (
    <FintechCard>
      <FintechCardHeader>
        <Skeleton className="h-5 w-40" />
      </FintechCardHeader>
      <FintechCardContent>
        <Skeleton className="h-[270px] w-full rounded-xl" />
      </FintechCardContent>
    </FintechCard>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full rounded-xl" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
