const API_URL = process.env.EXPO_PUBLIC_API_URL;

class ApiClient {
  private token: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  setOnUnauthorized(callback: () => void) {
    this.onUnauthorized = callback;
  }

  private getHeaders(isMultipart = false): Record<string, string> {
    const headers: Record<string, string> = {};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(method: string, path: string, body?: any, isMultipart = false) {
    const headers = this.getHeaders(isMultipart);
    const config: RequestInit = { method, headers };

    if (body) {
      config.body = isMultipart ? body : JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${path}`, config);

    if (response.status === 401) {
      // Parse the actual error message from backend
      const error = await response.json().catch(() => ({ detail: 'Invalid email or password' }));
      const message = error.detail || 'Invalid email or password';
      // Only trigger onUnauthorized for non-auth endpoints (i.e., expired token)
      if (!path.startsWith('/auth/')) {
        this.onUnauthorized?.();
      }
      throw new Error(message);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || error.message || 'Request failed');
    }

    return response.json();
  }

  get(path: string) {
    return this.request('GET', path);
  }

  post(path: string, body?: any) {
    return this.request('POST', path, body);
  }

  put(path: string, body?: any) {
    return this.request('PUT', path, body);
  }

  del(path: string) {
    return this.request('DELETE', path);
  }

  postMultipart(path: string, formData: FormData) {
    return this.request('POST', path, formData, true);
  }
}

export const api = new ApiClient();
