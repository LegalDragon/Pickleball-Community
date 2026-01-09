// Map of Tailwind color names to hex values for inline styles
// These match the colors used in EventTypesAdmin
const colorMap = {
  green: { bg: '#dcfce7', text: '#15803d', solid: '#22c55e' },
  blue: { bg: '#dbeafe', text: '#1d4ed8', solid: '#3b82f6' },
  yellow: { bg: '#fef9c3', text: '#a16207', solid: '#eab308' },
  purple: { bg: '#f3e8ff', text: '#7e22ce', solid: '#a855f7' },
  pink: { bg: '#fce7f3', text: '#be185d', solid: '#ec4899' },
  red: { bg: '#fee2e2', text: '#b91c1c', solid: '#ef4444' },
  orange: { bg: '#ffedd5', text: '#c2410c', solid: '#f97316' },
  teal: { bg: '#ccfbf1', text: '#0f766e', solid: '#14b8a6' },
  indigo: { bg: '#e0e7ff', text: '#4338ca', solid: '#6366f1' },
  cyan: { bg: '#cffafe', text: '#0e7490', solid: '#06b6d4' },
  emerald: { bg: '#d1fae5', text: '#047857', solid: '#10b981' },
  rose: { bg: '#ffe4e6', text: '#be123c', solid: '#f43f5e' },
  amber: { bg: '#fef3c7', text: '#b45309', solid: '#f59e0b' },
  slate: { bg: '#f1f5f9', text: '#475569', solid: '#64748b' },
};

// Default color (orange to match the app theme)
const defaultColor = { bg: '#ffedd5', text: '#c2410c', solid: '#f97316' };

/**
 * Get color values for a Tailwind color name
 * @param {string} colorName - The color name (e.g., 'green', 'blue')
 * @returns {{ bg: string, text: string, solid: string }} Color values
 */
export function getColorValues(colorName) {
  if (!colorName) return defaultColor;
  return colorMap[colorName.toLowerCase()] || defaultColor;
}

/**
 * Get background color for a color name
 * @param {string} colorName - The color name
 * @returns {string} Hex color code for background
 */
export function getBgColor(colorName) {
  return getColorValues(colorName).bg;
}

/**
 * Get text color for a color name
 * @param {string} colorName - The color name
 * @returns {string} Hex color code for text
 */
export function getTextColor(colorName) {
  return getColorValues(colorName).text;
}

/**
 * Get solid/primary color for a color name
 * @param {string} colorName - The color name
 * @returns {string} Hex color code for solid color
 */
export function getSolidColor(colorName) {
  return getColorValues(colorName).solid;
}

export default colorMap;
