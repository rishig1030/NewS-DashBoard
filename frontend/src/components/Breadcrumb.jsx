// NEW FILE: the "Back" button and the breadcrumb trail, e.g.
//     [ < Back to India channels ]   All countries > India > The Hindu

function ChevronLeft() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.5 4.5 7 10l5.5 5.5" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.5 4.5 13 10l-5.5 5.5" />
    </svg>
  );
}

/**
 * Props:
 *   items     - the trail, in order: [{ label, onClick }, ...]
 *               the LAST item is where you are now, so it needs no onClick
 *   onBack    - function called when the Back button is pressed
 *   backLabel - the words on the Back button
 */
function Breadcrumb({ items, onBack, backLabel }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-300 bg-white py-2 pl-3 pr-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        <ChevronLeft />
        {backLabel}
      </button>

      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {items.map((item, index) => {
            const isCurrent = index === items.length - 1;

            return (
              <li key={item.label} className="flex items-center gap-2">
                {index > 0 && <ChevronRight />}

                {isCurrent ? (
                  <span aria-current="page" className="font-semibold text-slate-900">
                    {item.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="rounded font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                  >
                    {item.label}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

export default Breadcrumb;