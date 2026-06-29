import { useState, useEffect, useCallback, useRef } from 'react';
import movieService   from '../services/movieService.js';
import userService    from '../services/userService.js';
import partyService   from '../services/partyService.js';

/**
 * useSearch — reusable debounced search hook.
 *
 * @param {object} options
 * @param {boolean} options.movies   — include movie results  (default true)
 * @param {boolean} options.users    — include user results   (default false)
 * @param {boolean} options.parties  — include party results  (default false)
 * @param {number}  options.debounce — debounce ms            (default 300)
 *
 * Returns:
 *   query        — controlled input value
 *   setQuery     — setter for the input
 *   results      — { movies: [], users: [], parties: [] }
 *   isSearching  — true when query is non-empty
 *   loading      — true while fetch is in flight
 *   clear        — resets query and results
 *   total        — total count across all enabled scopes
 */
export function useSearch({
  movies  = true,
  users   = false,
  parties = false,
  debounce = 300,
} = {}) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState({ movies: [], users: [], parties: [] });
  const [loading, setLoading] = useState(false);

  const abortRef = useRef(null);

  const clear = useCallback(() => {
    setQuery('');
    setResults({ movies: [], users: [], parties: [] });
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ movies: [], users: [], parties: [] });
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      // Cancel any previous in-flight fetch
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      try {
        const fetches = [];
        if (movies)  fetches.push(movieService.search(query).catch(() => []));
        if (users)   fetches.push(userService.searchUsers(query).catch(() => []));
        if (parties) fetches.push(partyService.getPublicRooms({ search: query }).catch(() => []));

        // Fill in empty arrays for disabled scopes
        const settled = await Promise.all(fetches);
        let i = 0;
        setResults({
          movies:  movies  ? (settled[i++] || []) : [],
          users:   users   ? (settled[i++] || []) : [],
          parties: parties ? (settled[i++] || []) : [],
        });
      } catch {
        // Swallow — aborted fetches throw
      } finally {
        setLoading(false);
      }
    }, debounce);

    return () => clearTimeout(timer);
  }, [query, movies, users, parties, debounce]);

  const total =
    results.movies.length +
    results.users.length  +
    results.parties.length;

  return {
    query,
    setQuery,
    results,
    isSearching: query.trim().length > 0,
    loading,
    clear,
    total,
  };
}