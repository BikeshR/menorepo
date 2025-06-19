import { HttpResponse, http } from "msw";
import type { Post, User } from "@/lib/api";

// Mock data
const mockPosts: Post[] = [
  {
    id: 1,
    title: "Test Post 1",
    body: "This is the body of test post 1",
    userId: 1,
  },
  {
    id: 2,
    title: "Test Post 2",
    body: "This is the body of test post 2",
    userId: 1,
  },
];

const mockUsers: User[] = [
  {
    id: 1,
    name: "John Doe",
    username: "johndoe",
    email: "john@example.com",
    phone: "1-770-736-8031 x56442",
    website: "johndoe.com",
  },
];

export const handlers = [
  // Posts endpoints
  http.get("https://jsonplaceholder.typicode.com/posts", () => {
    return HttpResponse.json(mockPosts);
  }),

  http.get("https://jsonplaceholder.typicode.com/posts/:id", ({ params }) => {
    const id = Number(params.id);
    const post = mockPosts.find((p) => p.id === id);

    if (!post) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(post);
  }),

  http.post("https://jsonplaceholder.typicode.com/posts", async ({ request }) => {
    const newPost = (await request.json()) as Omit<Post, "id">;
    const post: Post = {
      id: mockPosts.length + 1,
      ...newPost,
    };

    return HttpResponse.json(post, { status: 201 });
  }),

  http.put("https://jsonplaceholder.typicode.com/posts/:id", async ({ request, params }) => {
    const id = Number(params.id);
    const updates = (await request.json()) as Partial<Post>;
    const existingPost = mockPosts.find((p) => p.id === id);

    if (!existingPost) {
      return new HttpResponse(null, { status: 404 });
    }

    const updatedPost = { ...existingPost, ...updates };
    return HttpResponse.json(updatedPost);
  }),

  http.delete("https://jsonplaceholder.typicode.com/posts/:id", ({ params }) => {
    const id = Number(params.id);
    const postIndex = mockPosts.findIndex((p) => p.id === id);

    if (postIndex === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    return new HttpResponse(null, { status: 200 });
  }),

  // Users endpoints
  http.get("https://jsonplaceholder.typicode.com/users", () => {
    return HttpResponse.json(mockUsers);
  }),

  http.get("https://jsonplaceholder.typicode.com/users/:id", ({ params }) => {
    const id = Number(params.id);
    const user = mockUsers.find((u) => u.id === id);

    if (!user) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(user);
  }),

  // Error simulation endpoints
  http.get("https://jsonplaceholder.typicode.com/error", () => {
    return new HttpResponse(null, { status: 500 });
  }),
];
