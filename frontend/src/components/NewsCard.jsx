// One news article, drawn as a card.
import { useState } from 'react';

// Turn "2026-10-12T10:00:00Z" into a friendly date like "12 Oct 2026"
function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Props:
 *   article  - { url, title, description, imageUrl, author, sourceName, publishedAt }
 *   accent   - the brand colour of the current tab (used when there is no picture)
 *   initials - the tab's initials (shown in the no-picture placeholder)
 *   featured - true for the first (lead) story, which gets a bigger layout
 */
function NewsCard({ article, accent, initials, featured = false }) {
  // If the picture fails to load (broken link), we switch to the placeholder
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = article.imageUrl && !imageFailed;
  const date = formatDate(article.publishedAt);

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-lg ${
        featured ? 'md:col-span-2 md:flex-row' : ''
      }`}
    >
      {/* Picture area */}
      <div className={`relative aspect-video shrink-0 bg-slate-200 ${featured ? 'md:aspect-auto md:w-1/2' : ''}`}>
        {showImage ? (
          <img
            src={article.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 grid place-items-center text-4xl font-extrabold text-white/80"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          >
            {initials}
          </div>
        )}
      </div>

      {/* Text area */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        {article.sourceName && (
          <p className="text-sm font-semibold" style={{ color: accent }}>
            {article.sourceName}
          </p>
        )}

        <h3
          className={`font-bold leading-snug text-slate-900 ${
            featured ? 'text-xl line-clamp-4 md:text-2xl' : 'text-lg line-clamp-3'
          }`}
        >
          {article.title}
        </h3>

        {article.description && (
          <p className={`text-sm leading-relaxed text-slate-600 ${featured ? 'line-clamp-4' : 'line-clamp-3'}`}>
            {article.description}
          </p>
        )}

        {/* Footer pushed to the bottom of the card with mt-auto */}
        <div className="mt-auto flex items-end justify-between gap-4 pt-2">
          <div className="min-w-0 text-xs text-slate-500">
            <p className="truncate font-medium text-slate-700">{article.author || article.sourceName || 'Staff'}</p>
            {date && <p>{date}</p>}
          </div>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md text-sm font-semibold underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            style={{ color: accent }}
          >
            Read more
          </a>
        </div>
      </div>
    </article>
  );
}

export default NewsCard;