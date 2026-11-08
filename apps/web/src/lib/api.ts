import type { ApiResponse } from '@school/types';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

let accessToken: string | null = null;

export interface SessionUser {
  id: string;
  email: string;
  schoolId: string;
  roles: string[];
  permissions: string[];
  permissionScopes: Record<string, PermissionScope[]>;
}

export type PermissionScope = 'GLOBAL' | 'SCHOOL' | 'ASSIGNED' | 'LINKED' | 'OWN';

interface TokenResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: SessionUser;
}

export function clearAccessToken(): void {
  accessToken = null;
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = (await response.json()) as ApiResponse<TokenResponse>;
  if (!body.success) throw new Error(body.error.message);
  setAccessToken(body.data.accessToken);
  return body.data;
}

export async function refreshSession(): Promise<TokenResponse | null> {
  const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    clearAccessToken();
    return null;
  }

  const body = (await response.json()) as ApiResponse<TokenResponse>;
  if (!body.success) {
    clearAccessToken();
    return null;
  }

  setAccessToken(body.data.accessToken);
  return body.data;
}

async function authenticatedRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const request = async (): Promise<Response> => {
    const headers = new Headers(options.headers);
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(`${apiBaseUrl}${path}`, { ...options, credentials: 'include', headers });
  };

  let response = await request();
  if (response.status === 401 && accessToken && (await refreshSession())) {
    response = await request();
  }
  return response;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await authenticatedRequest(path, options);
  if (response.status === 204) return undefined as T;

  const body = (await response.json()) as ApiResponse<T>;

  if (!body.success) throw new Error(body.error.message);
  return body.data;
}

export async function apiDownloadCsv(path: string, filename: string): Promise<void> {
  const response = await authenticatedRequest(path);
  if (!response.ok) {
    const body = (await response.json()) as ApiResponse<unknown>;
    throw new Error(body.success ? 'Could not download report' : body.error.message);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function apiJson<T>(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function logoutRequest(): Promise<void> {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  await fetch(`${apiBaseUrl}/auth/logout`, { method: 'POST', credentials: 'include', headers });
  clearAccessToken();
}
