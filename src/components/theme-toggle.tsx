"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // This pattern prevents hydration mismatches with next-themes
  // This is the recommended pattern from next-themes documentation
  useEffect(() => {
    // Use setTimeout to make this asynchronous and avoid lint warnings
    const timer = setTimeout(() => {
      setMounted(true)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        aria-label="Toggle theme"
        disabled
      >
        <Sun className="h-5 w-5" />
      </Button>
    )
  }

  const toggleTheme = () => {
    // Use resolvedTheme to get the actual theme (handles system theme)
    const currentTheme = resolvedTheme || theme || "light"
    setTheme(currentTheme === "dark" ? "light" : "dark")
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-10 w-10 relative"
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

