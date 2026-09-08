// Simple API client for the whiteboard backend

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.port === "3001"
    ? ""
    : "http://localhost:3001");

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Board {
  id: string;
  title: string;
  share_code: string;
  created_at: string;
  updated_at: string;
  role?: string;
}

export function getToken(): string | null {
  return localStorage.getItem("wb_token");
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem("wb_token", token);
  } else {
    localStorage.removeItem("wb_token");
  }
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // default to JSON if sending body and not FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  async signup(email: string, password: string, name?: string) {
    const res = await request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    setToken(res.token);
    return res.user as User;
  },

  async login(email: string, password: string) {
    const res = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    return res.user as User;
  },

  async me(): Promise<User | null> {
    if (!getToken()) return null;
    try {
      const res = await request("/api/auth/me");
      return res.user;
    } catch {
      setToken(null);
      return null;
    }
  },

  logout() {
    setToken(null);
  },

  async getBoards(): Promise<{ owned: Board[]; shared: Board[] }> {
    return request("/api/boards");
  },

  async createBoard(title: string): Promise<Board> {
    return request("/api/boards", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },

  async getBoard(idOrCode: string): Promise<{ board: Board }> {
    return request(`/api/boards/${idOrCode}`);
  },

  async deleteBoard(id: string): Promise<void> {
    await request(`/api/boards/${id}`, { method: "DELETE" });
  },

  async uploadImage(file: File): Promise<{ url: string; filename: string }> {
    const form = new FormData();
    form.append("file", file);
    return request("/api/images/upload", {
      method: "POST",
      body: form,
    });
  },

  getImageUrl(path: string): string {
    if (path.startsWith("blob:") || path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
      return path;
    }
    return `${API_BASE}${path}`;
  },
};
