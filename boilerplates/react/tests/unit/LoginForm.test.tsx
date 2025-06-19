import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LoginForm } from "@/components/forms/LoginForm";
import { render } from "../utils/test-utils";

describe("LoginForm", () => {
  it("renders the login form correctly", () => {
    render(<LoginForm />);

    expect(screen.getByRole("heading", { name: /sign in to your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows validation errors for invalid inputs", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const submitButton = screen.getByRole("button", { name: /sign in/i });

    // Try to submit empty form
    await user.click(submitButton);

    // Wait for validation to trigger
    await waitFor(() => {
      // HTML5 validation will prevent submission
      expect(screen.getByLabelText(/email address/i)).toBeInvalid();
    });
  });

  it("submits the form with valid credentials", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    // Fill in valid credentials
    await user.type(emailInput, "admin@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    // Check for loading state
    expect(screen.getByRole("button", { name: /signing in/i })).toBeInTheDocument();

    // Wait for success message
    await waitFor(
      () => {
        expect(screen.getByText(/login successful/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("shows error message for invalid credentials", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    // Fill in invalid credentials
    await user.type(emailInput, "wrong@example.com");
    await user.type(passwordInput, "wrongpassword");
    await user.click(submitButton);

    // Wait for error message
    await waitFor(
      () => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("disables submit button while submitting", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    await user.type(emailInput, "admin@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    // Button should be disabled during submission
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  });
});
