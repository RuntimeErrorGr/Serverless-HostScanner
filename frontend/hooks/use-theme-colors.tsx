"use client"

import { useTheme } from "next-themes"

export function useThemeColors() {
  const { theme, systemTheme } = useTheme()

  // Determine if we're in dark mode
  const isDarkMode = theme === "dark" || (theme === "system" && systemTheme === "dark")

  // Chart colors that work well in both light and dark modes
  return {
    isDarkMode,
    chartColors: {
      primary: isDarkMode ? "#e5e5e5" : "#1a1a1a",     // Light gray / Dark gray
      secondary: isDarkMode ? "#cccccc" : "#333333",    // Lighter gray / Darker gray
      tertiary: isDarkMode ? "#b3b3b3" : "#4d4d4d",    // Mid gray / Mid dark gray
      quaternary: isDarkMode ? "#999999" : "#666666",   // Mid-dark gray / Light-dark gray
      accent: isDarkMode ? "#808080" : "#808080",       // Neutral gray for both modes
    },
    lineColors: {
      primary: isDarkMode ? "#ffffff" : "#000000",      // Pure white / Pure black
      secondary: isDarkMode ? "#cccccc" : "#333333",    // Light gray / Dark gray
    },
    barColors: {
      primary: isDarkMode ? "#e5e5e5" : "#1a1a1a",     // Light gray / Dark gray
    },
    pieColors: [
      isDarkMode ? "#e5e5e5" : "#1a1a1a",              // Light gray / Dark gray
      isDarkMode ? "#cccccc" : "#333333",              // Lighter gray / Darker gray
      isDarkMode ? "#b3b3b3" : "#4d4d4d",              // Mid gray / Mid dark gray
      isDarkMode ? "#999999" : "#666666",              // Mid-dark gray / Light-dark gray
      isDarkMode ? "#808080" : "#808080",              // Neutral gray
      isDarkMode ? "#666666" : "#999999",              // Mid-dark gray / Light-dark gray
      isDarkMode ? "#4d4d4d" : "#b3b3b3",              // Mid gray / Mid dark gray
      isDarkMode ? "#333333" : "#cccccc",              // Dark gray / Lighter gray
      isDarkMode ? "#1a1a1a" : "#e5e5e5",              // Dark gray / Lighter gray
    ],
    textColor: isDarkMode ? "#ffffff" : "#000000",
    gridColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
  }
}
