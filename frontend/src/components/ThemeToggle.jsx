import { useTheme } from '../theme/useTheme';

export default function ThemeToggle({ compact = false }) {
  const { isDark, toggleTheme } = useTheme();
  const nextThemeLabel = isDark ? 'Light mode' : 'Dark mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 shadow-sm transition hover:border-orange-300 hover:bg-slate-50 hover:text-orange-600 active:scale-95 ${
        compact
          ? 'h-9 w-9 p-0 sm:h-10 sm:w-10'
          : 'min-h-10 px-3 text-xs sm:px-4 sm:text-sm'
      }`}
      aria-label={`Switch to ${nextThemeLabel.toLowerCase()}`}
      title={`Switch to ${nextThemeLabel}`}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
      {!compact && (
        <span className="hidden sm:inline">{nextThemeLabel}</span>
      )}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.7 15.1A8.5 8.5 0 0 1 8.9 3.3 8.5 8.5 0 1 0 20.7 15.1Z" />
    </svg>
  );
}
