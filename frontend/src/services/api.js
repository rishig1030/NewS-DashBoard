// Everything related to talking to OUR backend lives in this file.
import axios from 'axios';

const BACKEND_DOWN_MESSAGE =
  'Cannot reach the server. Make sure the backend is running (run "npm run dev" in the backend folder).';

// In development, '/api' is forwarded to the backend by vite.config.js.
// When we deploy online, we will set VITE_API_URL to the real backend address.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000, // give up after 15 seconds
});

/**
 * Ask the backend for the headlines of one tab.
 * @param {string} sourceId  e.g. "bbc-news"
 * @param {{ signal?: AbortSignal }} options  lets the caller cancel the request
 * @returns {Promise<{ articles: Array, fetchedAt: string, cached: boolean, stale: boolean }>}
 */
export async function fetchNews(sourceId, { signal } = {}) {
  try {
    const { data } = await api.get(`/news/${encodeURIComponent(sourceId)}`, { signal });
    return data;
  } catch (error) {
    // The request was cancelled on purpose (user clicked another tab).
    // Pass it along untouched - App.jsx knows to ignore it.
    if (axios.isCancel(error)) throw error;

    // The backend answered with an error message of its own
    if (typeof error.response?.data?.error === 'string') {
      throw new Error(error.response.data.error);
    }

    // We got an answer, but not from our backend's error handler.
    // An empty "server error" usually means the backend is switched off.
    if (error.response) {
      if (error.response.status >= 500) throw new Error(BACKEND_DOWN_MESSAGE);
      throw new Error(`The server returned an unexpected error (code ${error.response.status}).`);
    }

    // No answer at all
    if (error.code === 'ECONNABORTED') {
      throw new Error('The server took too long to answer. Please try again.');
    }
    throw new Error(BACKEND_DOWN_MESSAGE);
  }
}