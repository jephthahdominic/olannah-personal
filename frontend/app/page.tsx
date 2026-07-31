import { fetchHealth } from '@/lib/fetchHealth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const apiUrl = process.env.API_URL ?? 'http://localhost:8000';
  let status = 'unknown';
  try {
    const health = await fetchHealth(apiUrl);
    status = health.status;
  } catch {
    status = 'unreachable';
  }

  return (
    <main>
      <h1>Dev Infra Bootstrap — Tailscale live</h1>
      <p>Backend status: {status}</p>
    </main>
  );
}
