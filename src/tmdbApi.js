// tmdbApi.js — on-the-fly TMDB fetching for movie data, recommendations, and search.
//
// In development, requests are proxied through Vite to avoid CORS and
// keep the API key out of the browser bundle. In production, requests
// go directly to TMDB (the key is still in the bundle — acceptable for
// a personal project).

const TMDB_BASE = import.meta.env.DEV
  ? "/api/tmdb"
  : "https://api.themoviedb.org/3"

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY

async function tmdbFetch(path) {
  const url = `${TMDB_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${TMDB_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${res.statusText}`)
  return res.json()
}

// ── Genre mapping ─────────────────────────────────────────────────────────────
const GENRE_MAP = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie",
  53: "Thriller", 10752: "War", 37: "Western",
}

export function mapGenreIds(ids) {
  return ids?.map(id => GENRE_MAP[id] || null).filter(Boolean) || []
}

// ── Core data: recommendations + details in one call ──────────────────────────
export async function fetchMovieData(tmdbId) {
  const [details, recs] = await Promise.all([
    tmdbFetch(`/movie/${tmdbId}`),
    tmdbFetch(`/movie/${tmdbId}/recommendations`),
  ])

  const meta = {
    title: details.title,
    genres: mapGenreIds(details.genres?.map(g => g.id) || details.genre_ids),
    year: details.release_date ? parseInt(details.release_date.slice(0, 4), 10) : null,
    tmdb_id: details.id,
    poster: details.poster_path,
    overview: details.overview,
    vote_avg: details.vote_average,
    runtime: details.runtime,
  }

  const neighbors = (recs.results || []).map(r => ({
    id: String(r.id),
    title: r.title,
    genres: mapGenreIds(r.genre_ids),
    year: r.release_date ? parseInt(r.release_date.slice(0, 4), 10) : null,
    poster: r.poster_path,
    vote_avg: r.vote_average,
    // TMDB doesn't give a similarity score; synthesise one from vote_average
    // so the graph link widths still vary meaningfully.
    snn: Math.round((r.vote_average || 5) * 5),
    tmdb_id: r.id,
  }))

  return { meta, neighbors }
}

// ── Search ────────────────────────────────────────────────────────────────────
export async function searchMovies(query) {
  const data = await tmdbFetch(`/search/movie?query=${encodeURIComponent(query)}&page=1`)
  return (data.results || [])
    .filter(r => r.id && r.title)
    .map(r => ({
      id: String(r.id),
      title: r.title,
      genres: mapGenreIds(r.genre_ids),
      year: r.release_date ? parseInt(r.release_date.slice(0, 4), 10) : null,
    }))
}

// ── Extras (credits, providers, external ids) ─────────────────────────────────
export async function fetchMovieDetails(tmdbId) {
  return tmdbFetch(`/movie/${tmdbId}`)
}

export async function fetchMovieCredits(tmdbId) {
  return tmdbFetch(`/movie/${tmdbId}/credits`)
}

export async function fetchMovieProviders(tmdbId) {
  return tmdbFetch(`/movie/${tmdbId}/watch/providers`)
}

export async function fetchMovieExternalIds(tmdbId) {
  return tmdbFetch(`/movie/${tmdbId}/external_ids`)
}

export async function fetchMovieExtras(tmdbId) {
  const [credits, providers, externalIds] = await Promise.all([
    fetchMovieCredits(tmdbId),
    fetchMovieProviders(tmdbId),
    fetchMovieExternalIds(tmdbId),
  ])

  const director = credits.crew?.find((p) => p.job === "Director")?.name || null
  const cast = credits.cast?.slice(0, 5).map((p) => p.name) || []

  const region = providers.results?.US || Object.values(providers.results || {})[0]
  const watchProviders = region?.flatrate?.map((p) => p.provider_name) || []

  return {
    director,
    cast,
    watchProviders,
    imdb_id: externalIds.imdb_id || null,
  }
}
