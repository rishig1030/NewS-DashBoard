// NEW FILE: Step 1 - the country selector.
import { useState } from 'react';

// The countries to offer. "code" is the two-letter code NewsAPI uses.
// Must match SUPPORTED_COUNTRIES in backend/server.js.
// To add a country: add a line here AND add its code in server.js.
const COUNTRIES = [
  { code: 'in', name: 'India' },
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'au', name: 'Australia' },
  { code: 'ca', name: 'Canada' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'it', name: 'Italy' },
  { code: 'br', name: 'Brazil' },
  { code: 'ar', name: 'Argentina' },
  { code: 'za', name: 'South Africa' },
];

// A small flag picture.
// Why a picture and not a flag emoji? Windows cannot draw flag emoji - it shows
// the letters "IN" instead of the Indian flag. A picture works on every device.
// (Flags: OpenMoji, loaded from the jsDelivr CDN.)
function Flag({ code }) {
  // If the picture cannot load, show the two letters instead
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="grid size-6 place-items-center rounded bg-slate-200 text-[10px] font-bold text-slate-600" aria-hidden="true">
        {code.toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={`https://cdn.jsdelivr.net/npm/country-flag-emoji-json@3.0.0/dist/images/${code.toUpperCase()}.svg`}
      alt=""
      width="24"
      height="24"
      onError={() => setFailed(true)}
      className="size-6 object-contain"
    />
  );
}

/**
 * Props:
 *   selectedCountry - the chosen { code, name }, or null if nothing chosen yet
 *   onSelect        - function called with the country object that was clicked
 */
function CountrySelector({ selectedCountry, onSelect }) {
  return (
    <section aria-labelledby="country-heading">
      <h2 id="country-heading" className="mb-3 text-lg font-bold">
        Choose a country
      </h2>

      <div role="group" aria-labelledby="country-heading" className="flex flex-wrap gap-2">
        {COUNTRIES.map((country) => {
          const isSelected = selectedCountry?.code === country.code;

          return (
            <button
              key={country.code}
              type="button"
              onClick={() => onSelect(country)}
              aria-pressed={isSelected}
              className={`flex items-center gap-2 rounded-full border py-1.5 pl-2 pr-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                isSelected
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Flag code={country.code} />
              {country.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default CountrySelector;