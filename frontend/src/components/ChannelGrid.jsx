// NEW FILE: Step 2 - the grid of news channels for the chosen country.
import { Spinner, ErrorMessage } from './Status.jsx';
import { getAccentColor, getInitials } from '../utils/branding.js';

/**
 * Props:
 *   country  - the chosen { code, name }
 *   status   - 'idle' | 'loading' | 'success' | 'error'  (where the loading is up to)
 *   sources  - the list of channels from the backend
 *   error    - an error message (only when status is 'error')
 *   stale    - true when the backend is showing an older saved copy
 *   onSelect - function called with the channel object that was clicked
 *   onRetry  - function called when "Try again" is pressed
 */
function ChannelGrid({ country, status, sources, error, stale, onSelect, onRetry }) {
  if (status === 'idle' || status === 'loading') {
    return <Spinner label={`Loading channels for ${country.name}...`} />;
  }

  if (status === 'error') {
    return <ErrorMessage title={`Could not load channels for ${country.name}`} message={error} onRetry={onRetry} />;
  }

  if (sources.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
        NewsAPI does not list any news channels for {country.name}. Try another country.
      </p>
    );
  }

  return (
    <section aria-labelledby="channel-heading">
      <h2 id="channel-heading" className="mb-1 text-lg font-bold">
        Choose a channel in {country.name}
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        {sources.length} {sources.length === 1 ? 'channel' : 'channels'} available
      </p>

      {stale && (
        <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The news service could not be reached, so you are seeing a saved copy of this list.
        </p>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sources.map((source) => {
          const accent = getAccentColor(source.id);

          return (
            <li key={source.id}>
              {/* The whole card is one big button */}
              <button
                type="button"
                onClick={() => onSelect(source)}
                className="flex h-full w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <div className="flex items-center gap-3">
                  {/* The "logo": initials on a colour made from the channel id */}
                  <span
                    className="grid size-12 shrink-0 place-items-center rounded-xl text-base font-extrabold text-white"
                    style={{ backgroundColor: accent }}
                    aria-hidden="true"
                  >
                    {getInitials(source.name)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 font-bold leading-snug text-slate-900">{source.name}</h3>
                    {source.category && <p className="text-sm capitalize text-slate-500">{source.category}</p>}
                  </div>
                </div>

                {source.description && (
                  <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{source.description}</p>
                )}

                <span
                  className="mt-auto text-sm font-semibold underline decoration-2 underline-offset-4"
                  style={{ color: accent }}
                >
                  See latest news
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default ChannelGrid;