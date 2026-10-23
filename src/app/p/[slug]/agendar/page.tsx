import type { Metadata } from "next";
import { StudioBookingPage } from "@/components/booking/studio-pages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agendar" };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ servico?: string }> };

export default async function StudioAgendarPage({ params, searchParams }: Props) {
  const [{ slug }, { servico }] = await Promise.all([params, searchParams]);
  return <StudioBookingPage slug={slug} servico={servico} />;
}
