import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Theme presets with descriptive names and color schemes
export const themePresets = {
  default: {
    id: 'default',
    name: 'Default Blue',
    description: 'Clean professional look with blue accents',
    colors: {
      bg: '#ffffff',
      text: '#111111',
      card: '#f4f4f4',
      input: '#d8d8d8',
      border: '#2994FF',
      accent: '#2994FF',
      accentHover: '#1a7ae6',
      accentLight: '#e6f3ff',
    }
  },
  dark: {
    id: 'dark',
    name: 'Dark Mode',
    description: 'Easy on the eyes with dark backgrounds',
    colors: {
      bg: '#0e0e0e',
      text: '#f1f1f1',
      card: '#1b1b1b',
      input: '#5a5a5a',
      border: '#41f30a',
      accent: '#F7C948',
      accentHover: '#e5b83d',
      accentLight: '#2a2510',
    }
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Breeze',
    description: 'Calm teal and aqua tones',
    colors: {
      bg: '#f0f9ff',
      text: '#0c4a6e',
      card: '#e0f2fe',
      input: '#bae6fd',
      border: '#0891b2',
      accent: '#0891b2',
      accentHover: '#0e7490',
      accentLight: '#cffafe',
    }
  },
  forest: {
    id: 'forest',
    name: 'Forest Green',
    description: 'Natural earthy green tones',
    colors: {
      bg: '#f0fdf4',
      text: '#14532d',
      card: '#dcfce7',
      input: '#bbf7d0',
      border: '#16a34a',
      accent: '#16a34a',
      accentHover: '#15803d',
      accentLight: '#d1fae5',
    }
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Orange',
    description: 'Warm and energetic orange palette',
    colors: {
      bg: '#fffbeb',
      text: '#78350f',
      card: '#fef3c7',
      input: '#fde68a',
      border: '#f59e0b',
      accent: '#f59e0b',
      accentHover: '#d97706',
      accentLight: '#fef9c3',
    }
  },
  royal: {
    id: 'royal',
    name: 'Royal Purple',
    description: 'Elegant purple theme',
    colors: {
      bg: '#faf5ff',
      text: '#3b0764',
      card: '#f3e8ff',
      input: '#e9d5ff',
      border: '#9333ea',
      accent: '#9333ea',
      accentHover: '#7c3aed',
      accentLight: '#ede9fe',
    }
  },
  rose: {
    id: 'rose',
    name: 'Rose Garden',
    description: 'Soft pink and rose tones',
    colors: {
      bg: '#fff1f2',
      text: '#881337',
      card: '#ffe4e6',
      input: '#fecdd3',
      border: '#e11d48',
      accent: '#e11d48',
      accentHover: '#be123c',
      accentLight: '#fce7f3',
    }
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep blue dark theme',
    colors: {
      bg: '#0f172a',
      text: '#e2e8f0',
      card: '#1e293b',
      input: '#334155',
      border: '#3b82f6',
      accent: '#3b82f6',
      accentHover: '#2563eb',
      accentLight: '#1e3a5f',
    }
  },
  pickleball: {
    id: 'pickleball',
    name: 'Pickleball Pro',
    description: 'Vibrant green inspired by pickleball courts',
    colors: {
      bg: '#ffffff',
      text: '#1a1a1a',
      card: '#f0fdf4',
      input: '#d1fae5',
      border: '#22c55e',
      accent: '#22c55e',
      accentHover: '#16a34a',
      accentLight: '#dcfce7',
    }
  },
}

const THEME_STORAGE_KEY = 'pickleball_theme'

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('default')
  const [isLoading, setIsLoading] = useState(true)

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (savedTheme && themePresets[savedTheme]) {
      setCurrentTheme(savedTheme)
      applyTheme(savedTheme)
    } else {
      applyTheme('default')
    }
    setIsLoading(false)
  }, [])

  // Apply theme CSS variables to document
  const applyTheme = (themeId) => {
    const theme = themePresets[themeId]
    if (!theme) return

    const root = document.documentElement
    const { colors } = theme

    // Set data-theme attribute for any CSS selectors that use it
    root.setAttribute('data-theme', themeId)

    // Apply CSS variables
    root.style.setProperty('--bg', colors.bg)
    root.style.setProperty('--text', colors.text)
    root.style.setProperty('--card', colors.card)
    root.style.setProperty('--input', colors.input)
    root.style.setProperty('--border', colors.border)
    root.style.setProperty('--accent', colors.accent)
    root.style.setProperty('--accent-hover', colors.accentHover)
    root.style.setProperty('--accent-light', colors.accentLight)
  }

  // Change theme and persist to localStorage
  const setTheme = (themeId) => {
    if (!themePresets[themeId]) {
      console.error(`Theme "${themeId}" not found`)
      return
    }

    setCurrentTheme(themeId)
    applyTheme(themeId)
    localStorage.setItem(THEME_STORAGE_KEY, themeId)
  }

  // Get current theme object
  const getTheme = () => themePresets[currentTheme]

  // Get all available presets
  const getPresets = () => Object.values(themePresets)

  // Check if theme is dark mode
  const isDarkTheme = () => {
    const darkThemes = ['dark', 'midnight']
    return darkThemes.includes(currentTheme)
  }

  const value = {
    currentTheme,
    setTheme,
    getTheme,
    getPresets,
    isDarkTheme,
    themePresets,
    isLoading,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export default ThemeContext
