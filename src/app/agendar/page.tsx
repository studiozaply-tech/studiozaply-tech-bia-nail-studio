import type { Metadata } from "next";
import { StudioBookingPage } from "@/components/booking/studio-pages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agendar" };

export default async function AgendarPage({ searchParams }: { searchParams: Promise<{ servico?: string }> }) {
  const { servico } = await searchParams;
  return <StudioBookingPage servico={servico} />;
}
