const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL?.replace(':3001', ':3001') || 'http://localhost:3001';

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  auth: {
    register: (data: { username: string; email?: string; password: string }) =>
      apiFetch<{ token: string; user: any }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    login: (data: { username: string; password: string }) =>
      apiFetch<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    guest: (username?: string) =>
      apiFetch<{ token: string; user: any }>('/api/auth/guest', {
        method: 'POST',
        body: JSON.stringify({ username }),
      }),
  },
  users: {
    get: (username: string) => apiFetch<any>(`/api/users/${username}`),
    matches: (username: string) => apiFetch<any[]>(`/api/users/${username}/matches`),
  },
  leaderboard: {
    global: (limit = 50) => apiFetch<any[]>(`/api/leaderboard?limit=${limit}`),
    byGame: (gameType: string, limit = 50) =>
      apiFetch<any[]>(`/api/leaderboard?gameType=${gameType}&limit=${limit}`),
  },
};
