// Everything related to talking to OUR backend lives in this file.
//
// CHANGED in version 2:
//   - the error handling moved into ONE helper (request) used by every call
//   - NEW: fetchSources()  asks for the channels of a country
//   - fetchNews() works as before, but now takes any channel id
import axios from 'axios';

const BACKEND_DOWN_MESSAGE =
  'Cannot reach the server. Make sure the backend is running (run "npm run dev" in the backend folder).';

// In development, '/api' is forwarded to the backend by vite.config.js.
// When we deploy online, we will set VITE_API_URL to the real backend address.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 60000, // free hosting can take ~30 seconds to wake up, so we wait up to 60
});

// NEW: one helper that makes a request and turns ANY failure into a plain,
// readable Error message. (Before, this code lived inside fetchNews.)
async function request(path, { signal, params } = {}) {
  try {
    const { data } = await api.get(path, { signal, params });
    return data;
  } catch (error) {
    // The request was cancelled on purpose (user clicked something else).
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

/**
 * NEW - Ask the backend which news channels exist for a country.
 * @param {string} countryCode  e.g. "in"
 * @param {{ signal?: AbortSignal }} options  lets the caller cancel the request
 * @returns {Promise<{ sources: Array, stale: boolean, fetchedAt: string }>}
 */
export function fetchSources(countryCode, options = {}) {
  return request('/sources', { ...options, params: { country: countryCode } });
}

/**
 * Ask the backend for the latest headlines of ONE channel.
 * @param {string} sourceId  e.g. "the-hindu"
 * @param {{ signal?: AbortSignal }} options  lets the caller cancel the request
 * @returns {Promise<{ articles: Array, stale: boolean, fetchedAt: string }>}
 */
export function fetchNews(sourceId, options = {}) {
  return request(`/news/${encodeURIComponent(sourceId)}`, options);
}