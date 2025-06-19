// API base configuration
const API_BASE_URL =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ||
  "https://jsonplaceholder.typicode.com";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new ApiError(
      `API call failed: ${response.statusText}`,
      response.status,
      response.statusText
    );
  }

  return response.json();
}

// Types
export interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  website: string;
}

// API functions
export const api = {
  // Posts
  getPosts: (): Promise<Post[]> => fetchApi("/posts"),
  getPost: (id: number): Promise<Post> => fetchApi(`/posts/${id}`),
  createPost: (post: Omit<Post, "id">): Promise<Post> =>
    fetchApi("/posts", {
      method: "POST",
      body: JSON.stringify(post),
    }),
  updatePost: (id: number, post: Partial<Post>): Promise<Post> =>
    fetchApi(`/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(post),
    }),
  deletePost: (id: number): Promise<void> =>
    fetchApi(`/posts/${id}`, {
      method: "DELETE",
    }),

  // Users
  getUsers: (): Promise<User[]> => fetchApi("/users"),
  getUser: (id: number): Promise<User> => fetchApi(`/users/${id}`),
};
