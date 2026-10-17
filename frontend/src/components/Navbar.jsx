// CHANGED in version 2: the top bar now only shows the app title.
// The row of source tabs is gone - choosing a country and a channel now
// happens in the main part of the page, so Navbar no longer needs any props.

function Navbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
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
          <p className="hidden text-sm text-slate-500 sm:block">Pick a country, pick a channel, read the news</p>
        </div>
      </div>
    </header>
  );
}

export default Navbar;