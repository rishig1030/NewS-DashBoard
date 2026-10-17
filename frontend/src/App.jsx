// The main screen. VERSION 2: three steps instead of one row of tabs.
//
//   Step 1  choose a COUNTRY           (CountrySelector)
//   Step 2  choose a CHANNEL           (ChannelGrid)
//   Step 3  read that channel's NEWS   (NewsCard grid)
//
// Which step is on screen depends on two pieces of state:
//   selectedCountry empty                         -> Step 1
//   selectedCountry chosen, selectedSource empty  -> Step 2
//   both chosen                                   -> Step 3
import { useEffect, useState } from 'react';
import Navbar from './components/Navbar.jsx';
import CountrySelector from './components/CountrySelector.jsx';
import ChannelGrid from './components/ChannelGrid.jsx';
import Breadcrumb from './components/Breadcrumb.jsx';
import NewsCard from './components/NewsCard.jsx';
import { Spinner, ErrorMessage } from './components/Status.jsx';
import { fetchSources, fetchNews } from './services/api.js';
import { getAccentColor, getInitials } from './utils/branding.js';

function App() {
  // "State" = information React remembers. When it changes, the screen updates.

  // NEW: the choices the visitor has made (null = nothing chosen yet)
  const [selectedCountry, setSelectedCountry] = useState(null); // { code, name }
  const [selectedSource, setSelectedSource] = useState(null); // { id, name, ... }

  // NEW: the data we fetched for each step.
  // "status" is one of: 'idle' (nothing yet), 'loading', 'success', 'error'
  const [sourcesList, setSourcesList] = useState([]);
  const [sourcesStatus, setSourcesStatus] = useState('idle');
  const [sourcesError, setSourcesError] = useState(null);
  const [sourcesStale, setSourcesStale] = useState(false);
  const [sourcesRetry, setSourcesRetry] = useState(0); // bumped by "Try again"

  const [articlesList, setArticlesList] = useState([]);
  const [articlesStatus, setArticlesStatus] = useState('idle');
  const [articlesError, setArticlesError] = useState(null);
  const [articlesMeta, setArticlesMeta] = useState({ fetchedAt: null, stale: false });
  const [articlesRetry, setArticlesRetry] = useState(0);

  // ---------------------------------------------------------------------------
  // NEW: runs whenever a different COUNTRY is chosen (or "Try again" is pressed):
  // asks the backend for that country's channels.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedCountry) return;

    // Lets us cancel this request if the visitor clicks something else first
    const controller = new AbortController();

    async function loadSources() {
      setSourcesStatus('loading');
      setSourcesError(null);

      try {
        const data = await fetchSources(selectedCountry.code, { signal: controller.signal });
        setSourcesList(data.sources);
        setSourcesStale(data.stale);
        setSourcesStatus('success');
      } catch (err) {
        if (err.code === 'ERR_CANCELED') return; // cancelled on purpose - ignore
        setSourcesError(err.message);
        setSourcesStatus('error');
      }
    }

    loadSources();
    return () => controller.abort(); // cleanup before the next request starts
  }, [selectedCountry, sourcesRetry]);

  // ---------------------------------------------------------------------------
  // CHANGED: runs whenever a different CHANNEL is chosen (or "Try again" is
  // pressed). In version 1 this ran when a tab was clicked.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedSource) return;

    const controller = new AbortController();

    async function loadArticles() {
      setArticlesStatus('loading');
      setArticlesError(null);

      try {
        const data = await fetchNews(selectedSource.id, { signal: controller.signal });
        setArticlesList(data.articles);
        setArticlesMeta({ fetchedAt: data.fetchedAt, stale: data.stale });
        setArticlesStatus('success');
      } catch (err) {
        if (err.code === 'ERR_CANCELED') return;
        setArticlesError(err.message);
        setArticlesStatus('error');
      }
    }

    loadArticles();
    return () => controller.abort();
  }, [selectedSource, articlesRetry]);

  // ---------------------------------------------------------------------------
  // NEW: what happens when the visitor clicks things
  // ---------------------------------------------------------------------------

  // Step 1 -> 2: a country was clicked
  function handleSelectCountry(country) {
    if (country.code === selectedCountry?.code) return; // same country: nothing to do
    setSelectedCountry(country);
    setSelectedSource(null);
    setSourcesList([]); // forget the previous country's channels...
    setSourcesStatus('loading'); // ...and show the spinner straight away
  }

  // Step 2 -> 3: a channel card was clicked
  function handleSelectSource(source) {
    setSelectedSource(source);
    setArticlesList([]);
    setArticlesStatus('loading');
  }

  // Back button / breadcrumb: go up one step (the channel list is kept, so
  // going back does NOT need to load it again)
  const goToChannels = () => setSelectedSource(null);

  // Back button / breadcrumb: go all the way back to Step 1
  const goToCountries = () => {
    setSelectedSource(null);
    setSelectedCountry(null);
  };

  // ---------------------------------------------------------------------------
  // What to draw
  // ---------------------------------------------------------------------------
  const step = selectedSource ? 3 : selectedCountry ? 2 : 1;

  // The trail shown above steps 2 and 3
  const crumbs = [{ label: 'All countries', onClick: goToCountries }];
  if (selectedCountry) {
    crumbs.push({ label: selectedCountry.name, onClick: selectedSource ? goToChannels : undefined });
  }
  if (selectedSource) {
    crumbs.push({ label: selectedSource.name });
  }

  const updatedAt = articlesMeta.fetchedAt
    ? new Date(articlesMeta.fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;

  // Colours and initials for the cards in Step 3
  const accent = selectedSource ? getAccentColor(selectedSource.id) : null;
  const initials = selectedSource ? getInitials(selectedSource.name) : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back button + breadcrumb: only after the first step */}
        {step > 1 && (
          <Breadcrumb
            items={crumbs}
            onBack={step === 3 ? goToChannels : goToCountries}
            backLabel={step === 3 ? `Back to ${selectedCountry.name} channels` : 'Back to countries'}
          />
        )}

        {/* Steps 1 and 2 */}
        {step < 3 && (
          <div className="flex flex-col gap-10">
            <CountrySelector selectedCountry={selectedCountry} onSelect={handleSelectCountry} />

            {step === 1 && (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-slate-600">
                Pick a country above to see its news channels.
              </p>
            )}

            {step === 2 && (
              <ChannelGrid
                country={selectedCountry}
                status={sourcesStatus}
                sources={sourcesList}
                error={sourcesError}
                stale={sourcesStale}
                onSelect={handleSelectSource}
                onRetry={() => setSourcesRetry((count) => count + 1)}
              />
            )}
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <section aria-labelledby="articles-heading">
            <div className="mb-6 border-l-4 pl-4" style={{ borderColor: accent }}>
              <h2 id="articles-heading" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {selectedSource.name}
              </h2>
              {articlesStatus === 'success' && updatedAt && (
                <p className="mt-1 text-sm text-slate-500">Updated at {updatedAt}</p>
              )}
            </div>

            {articlesStatus === 'success' && articlesMeta.stale && (
              <p role="status" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                The news service could not be reached, so you are seeing a saved copy of these headlines.
              </p>
            )}

            {/* Exactly one of these four things is shown at a time */}
            {(articlesStatus === 'idle' || articlesStatus === 'loading') && (
              <Spinner label={`Loading headlines from ${selectedSource.name}...`} />
            )}

            {articlesStatus === 'error' && (
              <ErrorMessage
                title={`Could not load ${selectedSource.name}`}
                message={articlesError}
                onRetry={() => setArticlesRetry((count) => count + 1)}
              />
            )}

            {articlesStatus === 'success' && articlesList.length === 0 && (
              <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
                No headlines from {selectedSource.name} right now. Go back and try another channel.
              </p>
            )}

            {articlesStatus === 'success' && articlesList.length > 0 && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {articlesList.map((article, index) => (
                  <NewsCard
                    key={article.url}
                    article={article}
                    accent={accent}
                    initials={initials}
                    featured={index === 0} // the first story is the big lead story
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-sm text-slate-500 sm:px-6 lg:px-8">
        Headlines provided by NewsAPI.org. All articles belong to their publishers. Flag icons by{' '}
        <a
          href="https://openmoji.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-slate-700"
        >
          OpenMoji
        </a>{' '}
        (CC BY-SA 4.0).
      </footer>
    </div>
  );
}

export default App;