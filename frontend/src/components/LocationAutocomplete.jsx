import { useEffect, useRef, useState } from 'react';
import { searchAddresses } from '../services/geoService';

const DROPDOWN_MAX_HEIGHT = 256;

export default function LocationAutocomplete({
  value,
  onInputChange,
  onSelect,
  placeholder = 'Search address or location',
  disabled = false,
  error = '',
  hasSelection = false,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [open, setOpen] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchComplete, setSearchComplete] = useState(false);
  const requestIdRef = useRef(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const updateDropdownDirection = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    setOpenAbove(
      spaceBelow < DROPDOWN_MAX_HEIGHT + 24 && spaceAbove > spaceBelow
    );
  };

  useEffect(() => {
    const handleOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    const handleViewportChange = () => {
      if (open) updateDropdownDirection();
    };

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    const query = String(value || '').trim();

    if (disabled || hasSelection || query.length < 3) {
      requestIdRef.current += 1;
      setSuggestions([]);
      setSearchError('');
      setLoading(false);
      setOpen(false);
      setActiveIndex(-1);
      setSearchComplete(false);
      return undefined;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;

    const timer = window.setTimeout(() => {
      setLoading(true);
      setSearchError('');
      setSearchComplete(false);

      searchAddresses(query)
        .then((result) => {
          if (requestIdRef.current !== currentRequestId) return;

          const nextSuggestions = Array.isArray(result?.suggestions)
            ? result.suggestions
            : [];

          setSuggestions(nextSuggestions);
          setActiveIndex(-1);
          setSearchComplete(true);
          updateDropdownDirection();
          setOpen(true);
        })
        .catch((requestError) => {
          if (requestIdRef.current !== currentRequestId) return;

          setSuggestions([]);
          setActiveIndex(-1);
          setSearchComplete(true);
          setSearchError(
            requestError.response?.data?.message ||
              requestError.message ||
              'Unable to search locations'
          );
          updateDropdownDirection();
          setOpen(true);
        })
        .finally(() => {
          if (requestIdRef.current === currentRequestId) {
            setLoading(false);
          }
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [value, disabled, hasSelection]);

  const handleInputChange = (event) => {
    onInputChange(event.target.value);
    updateDropdownDirection();
    setOpen(true);
    setActiveIndex(-1);
    setSearchComplete(false);
  };

  const handleSelect = (suggestion) => {
    setOpen(false);
    setSuggestions([]);
    setSearchError('');
    setActiveIndex(-1);
    onSelect(suggestion);
  };

  const handleKeyDown = (event) => {
    if (!open || suggestions.length === 0) {
      if (event.key === 'ArrowDown' && suggestions.length > 0) {
        updateDropdownDirection();
        setOpen(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) =>
        current >= suggestions.length - 1 ? 0 : current + 1
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1
      );
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const borderClass = error
    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
    : hasSelection
      ? 'border-green-400 focus:border-green-500 focus:ring-green-100'
      : 'border-slate-300 focus:border-orange-500 focus:ring-orange-100';

  const dropdownPositionClass = openAbove
    ? 'bottom-full mb-1.5'
    : 'top-full mt-1.5';

  return (
    <div
      ref={rootRef}
      className={`relative ${open ? 'z-[80]' : 'z-0'}`}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          updateDropdownDirection();
          if (suggestions.length > 0 || searchError) setOpen(true);
        }}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        className={`w-full rounded-lg border bg-white px-3.5 py-2.5 pr-24 text-sm text-slate-800 outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${borderClass}`}
      />

      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
        {loading ? 'Searching…' : hasSelection ? 'Selected' : 'Geoapify'}
      </span>

      {open && (suggestions.length > 0 || searchError || searchComplete) && (
        <div
          className={`absolute left-0 z-[90] max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl ${dropdownPositionClass}`}
          role="listbox"
        >
          {searchError ? (
            <p className="px-3 py-3 text-xs text-red-600">
              {searchError}
            </p>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-3">
              <p className="text-sm font-semibold text-slate-700">
                No precise match found
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Try the place/business name with village, district, postcode,
                or a Plus Code.
              </p>
            </div>
          ) : (
            suggestions.map((suggestion, index) => (
              <button
                key={
                  suggestion.placeId ||
                  `${suggestion.latitude}-${suggestion.longitude}-${suggestion.formatted}`
                }
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  // Keep the input/dropdown interaction stable before click selection.
                  event.preventDefault();
                }}
                onClick={() => handleSelect(suggestion)}
                className={`block w-full border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 ${
                  index === activeIndex
                    ? 'bg-orange-50'
                    : 'hover:bg-orange-50'
                }`}
              >
                <span className="block text-sm font-semibold text-slate-800">
                  {suggestion.name || suggestion.formatted}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                  {suggestion.name &&
                  suggestion.formatted !== suggestion.name
                    ? suggestion.formatted
                    : [
                        suggestion.city,
                        suggestion.state,
                        suggestion.postcode,
                        suggestion.country,
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
