import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Gallery } from './Gallery';

export const metadata: Metadata = { title: 'Olannah component library', robots: { index: false, follow: false } };

// Design and engineering review aid: shows every component with what it is for and its group. It is not a canvas screen, so it
// is off in production unless NEXT_PUBLIC_COMPONENT_GALLERY=on is set at build time.
export default function GalleryPage() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_COMPONENT_GALLERY !== 'on') notFound();
  return <Gallery />;
}
