import { z } from "zod";

// Simple form schema (for React 19 native forms)
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Complex form schema (for React Hook Form)
export const userProfileSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  preferences: z.object({
    newsletter: z.boolean(),
    notifications: z.boolean(),
    theme: z.enum(["light", "dark", "system"]),
  }),
  skills: z.array(z.object({ value: z.string() })).min(1, "Please select at least one skill"),
});

export type UserProfileFormData = z.infer<typeof userProfileSchema>;

// Post creation schema
export const createPostSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  body: z.string().min(20, "Content must be at least 20 characters"),
  tags: z.array(z.string()).optional(),
});

export type CreatePostFormData = z.infer<typeof createPostSchema>;
