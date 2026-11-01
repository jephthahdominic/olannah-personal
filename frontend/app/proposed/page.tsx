import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Proposed } from '../gallery/Proposed';

export const metadata: Metadata = { title: 'Olannah proposed additions', robots: { index: false, follow: false } };

// For the spec team: what the build holds that no BRD names. Gated like the gallery: off in production unless
// NEXT_PUBLIC_COMPONENT_GALLERY=on is set at build time.
export default function ProposedPage() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_COMPONENT_GALLERY !== 'on') notFound();
  return <Proposed />;
}
