import Link from "next/link";
import { cn } from "@/lib/utils";

/** Identificação visual da v1: somente o nome, sem logotipo. */
export function BrandName({ name = "BEATRIZ ABREU", className, href = "/" }: { name?: string; className?: string; href?: string | null }) {
  const content = (
    <span className={cn("font-display text-lg font-semibold tracking-[0.2em] text-primary-dark", className)}>{name}</span>
  );
  return href ? (
    <Link href={href} className="rounded-lg" aria-label={`${name} — página inicial`}>
      {content}
    </Link>
  ) : (
    content
  );
}
