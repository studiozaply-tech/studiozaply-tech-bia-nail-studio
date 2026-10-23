import type { Metadata } from "next";
import { StudioHomePage } from "@/components/booking/studio-pages";
import { getStudio } from "@/lib/data/public";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const studio = await getStudio(slug).catch(() => null);
  return studio ? { title: { absolute: `${studio.display_name} · Agendamento` } } : {};
}

export default async function StudioPage({ params }: Params) {
  const { slug } = await params;
  return <StudioHomePage slug={slug} />;
}
