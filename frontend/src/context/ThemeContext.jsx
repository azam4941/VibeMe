import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

/**
 * Determines if it's "day" (6 AM – 6 PM) or "night" (6 PM – 6 AM)
 */
function getTimeOfDay() {
  const hour = new Date().getHours();
  return (hour >= 6 && hour < 18) ? 'day' : 'night';
}

/**
 * Midday Purple — lighter, more vibrant purples for daytime
 */
const MIDDAY_THEME = {
  '--purple': '#9C27B0',
  '--purple-light': '#CE93D8',
  '--purple-pale': 'rgba(156, 39, 176, 0.12)',
  '--purple-mid': '#AB47BC',
  '--purple-dark': '#7B1FA2',

  '--pink': '#E040FB',
  '--pink-pale': 'rgba(224, 64, 251, 0.12)',

  '--navy': '#2D1B4E',
  '--navy2': '#3D2566',
  '--navy3': '#4E3380',
  '--navy4': '#7E57C2',

  '--bg': '#1F1038',
  '--card': 'rgba(61, 37, 102, 0.88)',
  '--border': 'rgba(156, 39, 176, 0.25)',

  '--text1': '#FFFFFF',
  '--text2': '#E1BEE7',
  '--text3': '#B39DDB',

  '--shadow-sm': '0 4px 12px rgba(156, 39, 176, 0.20)',
  '--shadow-md': '0 8px 32px rgba(156, 39, 176, 0.30)',
  '--shadow-lg': '0 16px 48px rgba(156, 39, 176, 0.40)',

  '--bg-gradient': 'radial-gradient(circle at 50% -20%, #7E57C2 0%, #2D1B4E 90%)',
  '--btn-gradient': 'linear-gradient(135deg, #9C27B0 0%, #E040FB 100%)',

  '--primary-400': '#CE93D8',
  '--primary-500': '#9C27B0',
  '--accent-400': '#AB47BC',
  '--border-accent': 'rgba(156, 39, 176, 0.3)',
};

/**
 * Midnight Purple — deep, rich, dark purples for nighttime
 */
const MIDNIGHT_THEME = {
  '--purple': '#7B2FFF',
  '--purple-light': '#A78BFA',
  '--purple-pale': 'rgba(123, 47, 255, 0.12)',
  '--purple-mid': '#8B5CF6',
  '--purple-dark': '#5B21B6',

  '--pink': '#C084FC',
  '--pink-pale': 'rgba(192, 132, 252, 0.12)',

  '--navy': '#0D0620',
  '--navy2': '#160E30',
  '--navy3': '#221647',
  '--navy4': '#3730A3',

  '--bg': '#0A0418',
  '--card': 'rgba(22, 14, 48, 0.90)',
  '--border': 'rgba(123, 47, 255, 0.2)',

  '--text1': '#FFFFFF',
  '--text2': '#C4B5FD',
  '--text3': '#7C6DAF',

  '--shadow-sm': '0 4px 12px rgba(123, 47, 255, 0.15)',
  '--shadow-md': '0 8px 32px rgba(123, 47, 255, 0.25)',
  '--shadow-lg': '0 16px 48px rgba(123, 47, 255, 0.35)',

  '--bg-gradient': 'radial-gradient(circle at 50% -20%, #3730A3 0%, #0D0620 90%)',
  '--btn-gradient': 'linear-gradient(135deg, #7B2FFF 0%, #C084FC 100%)',

  '--primary-400': '#A78BFA',
  '--primary-500': '#7B2FFF',
  '--accent-400': '#8B5CF6',
  '--border-accent': 'rgba(123, 47, 255, 0.3)',
};

export function ThemeProvider({ children }) {
  const [timeOfDay, setTimeOfDay] = useState(getTimeOfDay);

  const applyTheme = useCallback((tod) => {
    const theme = tod === 'day' ? MIDDAY_THEME : MIDNIGHT_THEME;
    const root = document.documentElement;
    for (const [prop, value] of Object.entries(theme)) {
      root.style.setProperty(prop, value);
    }
    // Also set a data attribute for CSS selectors
    root.setAttribute('data-theme', tod === 'day' ? 'midday' : 'midnight');
  }, []);

  useEffect(() => {
    applyTheme(timeOfDay);
  }, [timeOfDay, applyTheme]);

  // Check every minute if the time-of-day changed
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTod = getTimeOfDay();
      setTimeOfDay(prev => {
        if (prev !== currentTod) {
          console.log(`🌗 Theme switching to ${currentTod === 'day' ? 'Midday' : 'Midnight'} Purple`);
          return currentTod;
        }
        return prev;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ThemeContext.Provider value={{ timeOfDay, isDay: timeOfDay === 'day', isNight: timeOfDay === 'night' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export default ThemeContext;
