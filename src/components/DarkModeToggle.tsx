import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const savedMode = localStorage.getItem("nexora-dark-mode");
    const prefersDark = savedMode === null 
      ? true // Default to dark mode
      : savedMode === "dark";
    setIsDark(prefersDark);
    applyMode(prefersDark);
  }, []);

  const applyMode = (dark: boolean) => {
    if (dark) {
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
    }
  };

  const toggleMode = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem("nexora-dark-mode", newMode ? "dark" : "light");
    applyMode(newMode);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleMode}
      className="hover:bg-primary/10 transition-all hover:scale-110"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-primary" />
      ) : (
        <Moon className="w-5 h-5 text-primary" />
      )}
    </Button>
  );
}
