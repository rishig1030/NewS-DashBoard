// The main screen: it decides WHICH tab is selected, asks the backend for that
// tab's headlines, and shows a spinner, an error message, or the news grid.
import { useEffect, useState } from 'react';
import Navbar from './components/Navbar.jsx';
import NewsCard from './components/NewsCard.jsx';
import { fetchNews } from './services/api.js';

// The tabs. Each "id" must match a key in SOURCES inside backend/server.js.
const SOURCES = [
  { id: 'bbc-news', name: 'BBC News', initials: 'BBC', color: '#BB1919' },
  { id: 'cnn', name: 'CNN', initials: 'CNN', color: '#CC0000' },
  { id: 'techcrunch', name: 'TechCrunch', initials: 'TC', color: '#0A8F4B' },
  { id: 'the-verge', name: 'The Verge', initials: 'V', color: '#5200FF' },
  { id: 'wired', name: 'Wired', initials: 'W', color: '#2B2B2B' },
  { id: 'al-jazeera-english', name: 'Al Jazeera', initials: 'AJ', color: '#A16207' },
  { id: 'business', name: 'Business', initials: 'B', color: '#0F766E' },
  { id: 'science', name: 'Science', initials: 'S', color: '#1D4ED8' },
];

// A spinning ring shown while headlines are loading
function Spinner({ color }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4 py-24 text-slate-500">
      <div
        className="size-12 rounded-full border-4 border-slate-200 motion-safe:animate-spin"
        style={{ borderTopColor: color }}
      />
      <p className="text-sm font-medium">Loading headlines...</p>
    </div>
  );
}

function App() {
  // "State" = information React remembers. When it changes, the screen updates.
  const [activeId, setActiveId] = useState(SOURCES[0].id); // which tab is selected
  const [articles, setArticles] = useState([]); // the headlines to show
  const [meta, setMeta] = useState({ fetchedAt: null, stale: false }); // extra info from the backend
  const [loading, setLoading] = useState(true); // are we waiting for the backend?
  const [error, setError] = useState(null); // an error message, or null
  const [retryCount, setRetryCount] = useState(0); // bumped by "Try again" to reload

  const activeSource = SOURCES.find((source) => source.id === activeId);

  // This runs on the first visit, every time a different tab is chosen,
  // and every time "Try again" is pressed.
  useEffect(() => {
    // Lets us cancel this request if the user clicks another tab before it finishes
    const controller = new AbortController();

    async function loadNews() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchNews(activeId, { signal: controller.signal });
        setArticles(data.articles);
        setMeta({ fetchedAt: data.fetchedAt, stale: data.stale });
      } catch (err) {
        if (err.code === 'ERR_CANCELED') return; // we cancelled it on purpose - ignore
        setArticles([]);
        setError(err.message);
      } finally {
        // Don't switch the spinner off if a newer request has taken over
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadNews();

    // Cleanup: runs before the next request starts
    return () => controller.abort();
  }, [activeId, retryCount]);

  const updatedAt = meta.fetchedAt
    ? new Date(meta.fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Navbar sources={SOURCES} activeId={activeId} onSelect={setActiveId} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Heading for the selected tab */}
        <div className="mb-6 border-l-4 pl-4" style={{ borderColor: activeSource.color }}>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{activeSource.name}</h2>
          {!loading && !error && updatedAt && (
            <p className="mt-1 text-sm text-slate-500">Updated at {updatedAt}</p>
          )}
        </div>

        {/* Shown when the backend is serving an older saved copy */}
        {!loading && !error && meta.stale && (
          <p role="status" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            The news service could not be reached, so you are seeing a saved copy of these headlines.
          </p>
        )}

        {/* Exactly one of these four things is shown at a time */}
        {loading && <Spinner color={activeSource.color} />}

        {!loading && error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <p className="font-semibold">Could not load {activeSource.name}</p>
            <p className="mt-1 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            No headlines for {activeSource.name} right now. Try another tab.
          </p>
        )}

        {!loading && !error && articles.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article, index) => (
              <NewsCard
                key={article.url}
                article={article}
                accent={activeSource.color}
                initials={activeSource.initials}
                featured={index === 0} // the first story is the big lead story
              />
            ))}
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-sm text-slate-500 sm:px-6 lg:px-8">
        Headlines provided by NewsAPI.org. All articles belong to their publishers.
      </footer>
    </div>
  );
}

export default App;