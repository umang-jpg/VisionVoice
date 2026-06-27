export const lightTheme = {
  background: '#fbf8ff',
  onBackground: '#191b24',
  primary: '#0040e0', // From Stitch Mockups
  onPrimary: '#ffffff',
  surface: '#fbf8ff',
  surfaceContainerLow: '#f3f2ff',
  border: '#000000',
  error: '#ba1a1a',
  
  // Semantic Colors Preserved from original VisionVoice PRD
  semantic: {
    accent: '#5f0a87', // Indigo
    neutral: '#475569', // Dark Slate for visibility on light bg
    success: '#248232', // Forest Green (Processing / Success)
    danger: '#ec4e20', // Spicy Paprika (Listening / Error)
  },
};

export const darkTheme = {
  background: '#0a0a0a',
  onBackground: '#fbf8ff',
  primary: '#4c7cff', // Lightened primary for dark mode contrast
  onPrimary: '#ffffff',
  surface: '#1A1A1A',
  surfaceContainerLow: '#262626',
  border: '#f5e2c8', // Use Champagne Mist as border color in dark mode
  error: '#ffb4ab',
  
  // Semantic Colors
  semantic: {
    accent: '#a544df', // Lighter Indigo
    neutral: '#f5e2c8', // Champagne Mist
    success: '#4ade80', // Lighter Green
    danger: '#ff7c6b', // Lighter Paprika
  },
};

export const getTheme = (mode) => (mode === 'dark' ? darkTheme : lightTheme);

export const TYPOGRAPHY = {
  headline: 'Anybody',
  body: 'SpaceMono',
};

// Returns standard Neo-Brutalist shadow objects
export const getShadows = (theme) => ({
  neo: {
    shadowColor: theme.border,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  neoSm: {
    shadowColor: theme.border,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
});
