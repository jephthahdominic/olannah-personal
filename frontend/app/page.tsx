import { fetchHealth } from '@/lib/fetchHealth';

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
      <h1>Dev Infra Bootstrap</h1>
      <p>Backend status: {status}</p>
    </main>
  );
}
