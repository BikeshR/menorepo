import { ComputerDesktopIcon, MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import * as React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

const ThemeToggle = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getIcon = () => {
    switch (theme) {
      case "light":
        return <SunIcon className="h-4 w-4" />;
      case "dark":
        return <MoonIcon className="h-4 w-4" />;
      default:
        return <ComputerDesktopIcon className="h-4 w-4" />;
    }
  };

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={cn("h-9 w-9 p-0", className)}
      title={`Switch to ${theme === "light" ? "dark" : theme === "dark" ? "system" : "light"} theme`}
      {...props}
    >
      {getIcon()}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
});

ThemeToggle.displayName = "ThemeToggle";

export { ThemeToggle };
