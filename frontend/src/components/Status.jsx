// NEW FILE: the loading spinner and the error box.
// In version 1 these lived inside App.jsx. Now two screens need them (the
// channel list and the article list), so they have their own file.

// A spinning ring shown while something is loading
export function Spinner({ label = 'Loading...' }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4 py-24 text-slate-500">
      <div className="size-12 rounded-full border-4 border-slate-200 border-t-slate-700 motion-safe:animate-spin" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

// A red box with a message and a "Try again" button
export function ErrorMessage({ title, message, onRetry }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
      >
        Try again
      </button>
    </div>
  );
}