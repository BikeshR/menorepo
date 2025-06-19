import { useId, useState } from "react";
import { loginSchema } from "@/lib/validations";

// Server action simulation (in real app, this would be in a server component)
async function loginAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  // Validate with Zod
  const result = loginSchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: result.error.errors[0]?.message || "Validation failed",
    };
  }

  // Simulate login logic
  if (data.email === "admin@example.com" && data.password === "password123") {
    return { success: true };
  }

  return { success: false, error: "Invalid email or password" };
}

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    try {
      const result = await loginAction(formData);

      if (result.success) {
        setSuccess(true);
        // In a real app, you might redirect here
        console.log("Login successful!");
      } else {
        setError(result.error || "Login failed");
      }
    } catch (_err) {
      setError("An unexpected error occurred");
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <h3 className="text-lg font-medium text-green-800">Login Successful!</h3>
        <p className="text-green-700">Welcome back to the application.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h2 className="text-center text-3xl font-bold tracking-tight">Sign in to your account</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          React 19 Native Form Example
        </p>
      </div>

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={emailId} className="block text-sm font-medium">
            Email address
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label htmlFor={passwordId} className="block text-sm font-medium">
            Password
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            placeholder="Enter your password"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="text-center text-xs text-muted-foreground">
        Try: admin@example.com / password123
      </div>
    </div>
  );
}
