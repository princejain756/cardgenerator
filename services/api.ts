import { Attendee, User, SavedTemplate } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

type LoginResponse = { token: string; user: User };

type RequestOptions = {
  method?: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
};

const buildHeaders = (token?: string, extra?: Record<string, string>) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const request = async <T>(path: string, options: RequestOptions = {}, token?: string): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: buildHeaders(token, options.headers)
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const errData = await res.json();
      message = errData?.message || message;
    } catch (_) {
      // ignore
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json();
};

export const login = (username: string, password: string) =>
  request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const fetchMe = (token: string) =>
  request<User>('/auth/me', { method: 'GET' }, token);

export const createUser = (token: string, payload: { username: string; password: string; role?: 'admin' | 'user' }) =>
  request<User>('/users', { method: 'POST', body: JSON.stringify(payload) }, token);

export const fetchAttendees = (token: string) =>
  request<Attendee[]>('/attendees', { method: 'GET' }, token);

export const importAttendees = (token: string, attendees: Attendee[]) =>
  request<{ count: number }>('/attendees/import', { method: 'POST', body: JSON.stringify({ attendees }) }, token);

export const updateAttendee = (token: string, id: string, data: Partial<Attendee>) =>
  request<Attendee>('/attendees/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(data) }, token);

export const bulkUpdateAttendees = (token: string, ids: string[], data: Partial<Attendee>) =>
  request<{ updated: number }>('/attendees/bulk', { method: 'PATCH', body: JSON.stringify({ ids, data }) }, token);

export const deleteAttendee = (token: string, id: string) =>
  request<void>('/attendees/' + encodeURIComponent(id), { method: 'DELETE' }, token);

export const deleteAllAttendees = (token: string) =>
  request<void>('/attendees', { method: 'DELETE' }, token);

export const fetchSavedTemplates = (token: string) =>
  request<SavedTemplate[]>('/templates', { method: 'GET' }, token);

export const saveTemplate = (token: string, data: Partial<SavedTemplate>) =>
  request<SavedTemplate>('/templates', { method: 'POST', body: JSON.stringify(data) }, token);

export const updateTemplate = (token: string, id: string, data: Partial<SavedTemplate>) =>
  request<SavedTemplate>('/templates/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(data) }, token);

export const deleteTemplate = (token: string, id: string) =>
  request<void>('/templates/' + encodeURIComponent(id), { method: 'DELETE' }, token);
