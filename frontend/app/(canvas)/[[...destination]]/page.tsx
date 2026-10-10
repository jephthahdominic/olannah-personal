import { knownRoutes } from '@/render/navigation/routing';
import { CanvasRoot } from '../CanvasRoot';

// The canvas is a client-rendered app (SDD ADR-002). The URL path carries the current destination so a reload returns
// the worker to the same place with no browser storage (ADR-010). The page renders the boot gate's initial state, the
// session loading screen, into the HTML, so first paint needs no JavaScript. Nothing is fetched on the server.
export function generateStaticParams() {
  return knownRoutes().map((route) => ({ destination: route === '/' ? [] : route.split('/').filter(Boolean) }));
}

export default function CanvasPage() {
  return <CanvasRoot />;
}
