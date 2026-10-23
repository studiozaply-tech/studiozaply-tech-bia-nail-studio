import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-3 px-5 pt-20" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-9 w-2/3" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </main>
  );
}
