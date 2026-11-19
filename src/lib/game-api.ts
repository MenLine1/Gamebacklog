import type { Game, GameInput } from '@/types/game';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Żądanie nie powiodło się (${response.status}).`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const gameApi = {
  list: () => request<Game[]>('/api/games'),
  create: (input: GameInput) => request<Game>('/api/games', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: GameInput) => request<Game>(`/api/games/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/api/games/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
