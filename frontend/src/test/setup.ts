import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement matchMedia; ThemeContext reads it to seed the
// initial light/dark choice from the OS preference.
window.matchMedia =
  window.matchMedia ??
  ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
