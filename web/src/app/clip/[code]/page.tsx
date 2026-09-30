import type { Metadata } from "next";
import Link from "next/link";
import { decodeClip } from "@/lib/clip";
import { ClipViewer } from "@/components/ClipViewer";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const clip = decodeClip(code);
  return { title: clip ? `${clip.title} · larpers` : "Clip · larpers", description: clip ? `A ${((clip.end - clip.start) / 10).toFixed(1)} s tracking-data clip` : undefined };
}

export default async function ClipPage({ params }: Props) {
  const { code } = await params;
  const clip = decodeClip(code);
  if (!clip) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md p-6">
          <h1 className="text-lg font-semibold">This clip link is not valid</h1>
          <p className="mt-2 text-sm text-muted">The link may have been cut short when it was pasted. Ask for it again, or open the full match.</p>
          <Link href="/" className="btn mt-4">
            Back to start
          </Link>
        </div>
      </div>
    );
  }
  return <ClipViewer clip={clip} />;
}
