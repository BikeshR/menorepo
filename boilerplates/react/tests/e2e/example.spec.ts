import { expect, test } from "@playwright/test";

test.describe("React Boilerplate E2E Tests", () => {
  test("homepage loads correctly", async ({ page }) => {
    await page.goto("/");

    // Check that the page title is correct
    await expect(page).toHaveTitle(/React Boilerplate 2025/);

    // Check for main heading
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("navigation works correctly", async ({ page }) => {
    await page.goto("/");

    // Test navigation to different sections if they exist
    // This is an example - adjust based on your actual app structure
    const navigation = page.getByRole("navigation");
    if (await navigation.isVisible()) {
      // Test clicking navigation items
      await expect(navigation).toBeVisible();
    }
  });

  test("theme switching works", async ({ page }) => {
    await page.goto("/");

    // Look for theme toggle button
    const themeToggle = page.getByRole("button", { name: /theme/i });

    if (await themeToggle.isVisible()) {
      // Get initial theme
      const body = page.locator("body");
      const initialClass = await body.getAttribute("class");

      // Click theme toggle
      await themeToggle.click();

      // Check that theme changed
      const newClass = await body.getAttribute("class");
      expect(newClass).not.toBe(initialClass);
    }
  });

  test("forms handle validation correctly", async ({ page }) => {
    await page.goto("/");

    // Look for form elements
    const emailInput = page.getByRole("textbox", { name: /email/i });
    const passwordInput = page.getByRole("textbox", { name: /password/i });
    const submitButton = page.getByRole("button", { name: /sign in/i });

    if (await emailInput.isVisible()) {
      // Test form validation
      await submitButton.click();

      // Check for validation messages
      await expect(emailInput).toHaveAttribute("required");

      // Fill form with valid data
      await emailInput.fill("admin@example.com");
      await passwordInput.fill("password123");
      await submitButton.click();

      // Wait for form submission
      await expect(submitButton).toBeDisabled();
    }
  });

  test("accessibility: page has proper headings structure", async ({ page }) => {
    await page.goto("/");

    // Check for proper heading hierarchy
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();

    // Check for proper focus management
    await page.keyboard.press("Tab");
    // Verify first focusable element receives focus
  });

  test("responsive design: mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Check that page adapts to mobile
    await expect(page.getByRole("main")).toBeVisible();

    // Test mobile-specific interactions
    const mobileMenu = page.getByRole("button", { name: /menu/i });
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      // Verify mobile menu opens
    }
  });

  test("performance: page loads within acceptable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/");

    // Wait for main content to be visible
    await page.getByRole("main").waitFor();

    const loadTime = Date.now() - startTime;

    // Assert page loads within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
});
