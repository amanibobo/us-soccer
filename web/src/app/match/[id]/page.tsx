import type { Metadata } from "next";
import { Editor } from "@/components/Editor";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Match ${id} · Touchline` };
}

export default async function MatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { t } = await searchParams;
  const initialTime = t != null && /^\d+$/.test(t) ? Number(t) : undefined;
  return <Editor matchId={id} initialTime={initialTime} />;
}
