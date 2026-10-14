// The top bar: the app title and one clickable "logo tab" for every news source.

/**
 * Props (the information App.jsx hands to this component):
 *   sources  - list of tabs: { id, name, initials, color }
 *   activeId - the id of the tab that is currently selected
 *   onSelect - a function to call with a tab's id when it is clicked
 */
function Navbar({ sources, activeId, onSelect }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Title row */}
        <div className="flex items-center gap-3 py-4">
          <div
            className="grid size-10 place-items-center rounded-xl bg-slate-900 text-white"
            aria-hidden="true"
          >
            {/* A small "newspaper" icon drawn with SVG */}
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h11a1 1 0 0 1 1 1v14H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1Z" />
              <path d="M17 9h2a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2h-1" />
              <path d="M8 8h6M8 12h6M8 16h3" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-extrabold leading-tight tracking-tight">Front Page</h1>
            <p className="hidden text-sm text-slate-500 sm:block">Top headlines, one source at a time</p>
          </div>
        </div>

        {/* Tabs row. On small screens it scrolls sideways. */}
        <nav
          aria-label="News sources"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sources.map((source) => {
            const isActive = source.id === activeId;

            return (
              <button
                key={source.id}
                type="button"
                onClick={() => onSelect(source.id)}
                aria-current={isActive ? 'true' : undefined}
                // Colours that change per tab are set with "style" because
                // Tailwind can only see class names that are written out in full.
                style={isActive ? { backgroundColor: source.color, borderColor: source.color } : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                  isActive
                    ? 'text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {/* The round "logo": the source's initials on its brand colour */}
                <span
                  className={`grid size-8 place-items-center rounded-full font-bold tracking-tight text-white ${
                    source.initials.length > 2 ? 'text-[10px]' : 'text-xs'
                  }`}
                  style={{ backgroundColor: isActive ? 'rgba(255, 255, 255, 0.25)' : source.color }}
                  aria-hidden="true"
                >
                  {source.initials}
                </span>
                {source.name}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;