const TMDB_IMG = "https://image.tmdb.org/t/p/w300"

export default function MoviePanel({ node, loadingDetails, theme, onClose, onMoreDetails, mode }) {
  const t = theme ?? { surface: "#fdfbf7", border: "rgba(0,0,0,0.06)", text: "#2d2a26", textMuted: "rgba(45,42,38,0.45)", textFaint: "rgba(45,42,38,0.35)", accent: "#c47e2a", accentBg: "rgba(196,126,42,0.12)" }

  if (!node) return null

  const title    = node.title
  const year     = node.year
  const genres   = node.genres ?? []
  const poster   = node.poster ?? null
  const posterUrl = poster?.startsWith("http") ? poster : poster ? `${TMDB_IMG}${poster}` : null
  const imdbId   = node.imdb_id ?? null
  const rating   = node.vote_avg ?? null
  const runtime  = node.runtime ?? null
  const seasons  = node.seasons ?? null
  const runtimeDisplay = mode === "tv"
    ? (seasons != null ? `${seasons} season${seasons !== 1 ? "s" : ""}` : runtime ? `${runtime} min/ep` : null)
    : (runtime ? (typeof runtime === "number" ? `${runtime} min` : String(runtime)) : null)
  const director = node.director ?? null
  const cast     = node.cast ?? []
  const overview = node.overview ?? ""
  const watchProviders = node.watchProviders ?? []

  return (
    <div style={{ ...s.panel, background: t.surface, borderLeft: `1px solid ${t.border}` }}>
      <button style={{ ...s.collapseBtn, background: t.surface, borderColor: t.border, color: t.textMuted }} onClick={onClose} title="Hide details">►</button>

      {posterUrl ? (
        <img src={posterUrl} alt={title} style={s.poster} />
      ) : (
        <div style={{ ...s.posterPlaceholder, background: t.border }}>{mode === "tv" ? "📺" : "🎦"}</div>
      )}

      <div style={{ ...s.title, color: t.text }}>{title}</div>

      {(node.tmdb_id ?? node.id) && (
        <a
          href={`https://www.themoviedb.org/${mode === "tv" ? "tv" : "movie"}/${node.tmdb_id ?? node.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...s.tmdbLink, color: t.accent }}
        >
          View on TMDB ↗
        </a>
      )}

      {imdbId && (
        <a
          href={`https://www.imdb.com/title/${imdbId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...s.tmdbLink, color: t.accent }}
        >
          View on IMDb ↗
        </a>
      )}

      {(year || rating != null || runtimeDisplay) && (
        <div style={{ ...s.meta, color: t.textMuted }}>
          {year && <span>{year}</span>}
          {rating != null && (
            <span style={{ color: t.accent, display: "flex", alignItems: "center", gap: 4 }}>
              <span>★ {rating.toFixed(1)}</span>
            </span>
          )}
          {runtimeDisplay && <span>{runtimeDisplay}</span>}
        </div>
      )}

      {genres.length > 0 && (
        <div style={s.genreRow}>
          {genres.map(g => (
            <span key={g} style={{ ...s.genrePill, background: t.accentBg, color: t.accent }}>{g}</span>
          ))}
        </div>
      )}

      {overview && (
        <div style={{ ...s.plotWrap, color: t.textMuted }}>
          <p style={{ ...s.plotText, color: t.textMuted }}>{overview}</p>
        </div>
      )}

      {loadingDetails && (
        <div style={{ ...s.loading, color: t.textMuted }}>Loading details…</div>
      )}

      {/* ── Detailed metadata (fetched on-the-fly from TMDB) ────── */}
      {director && (
        <div style={{ ...s.metaExtra, color: t.textMuted }}>
          <span><b>Director</b> {director}</span>
        </div>
      )}

      {cast.length > 0 && (
        <div style={s.castRow}>
          <div style={{ ...s.castLabel, color: t.textFaint }}>Cast</div>
          {cast.map(name => <span key={name} style={{ ...s.castName, color: t.textMuted }}>{name}</span>)}
        </div>
      )}

      {watchProviders.length > 0 && (
        <div style={s.providerRow}>
          <div style={{ ...s.castLabel, color: t.textFaint }}>Watch on</div>
          <div style={s.providerWrap}>
            {watchProviders.map(p => (
              <span key={p} style={{ ...s.providerPill, background: t.accentBg, color: t.accent }}>{p}</span>
            ))}
          </div>
        </div>
      )}

      {onMoreDetails && (
        <button
          style={{ ...s.moreBtn, background: t.accentBg, color: t.accent, borderColor: t.accent }}
          onClick={onMoreDetails}
        >
          More details →
        </button>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  panel:            { position: "absolute", top: 0, right: 0, bottom: 0, width: 280, zIndex: 10,
                      background: "#fdfbf7", borderLeft: "1px solid rgba(0,0,0,0.06)",
                      padding: "60px 18px 18px", display: "flex", flexDirection: "column",
                      gap: 10, overflowY: "auto" },
  collapseBtn:      { position: "absolute", top: 16, left: 0,
                      background: "#fdfbf7", border: "1px solid rgba(0,0,0,0.08)",
                      borderLeft: "none", borderRadius: "0 6px 6px 0",
                      padding: "10px 4px", color: "#8a8278", fontSize: 12,
                      cursor: "pointer", lineHeight: 1, zIndex: 11 },
  loading:          { color: "rgba(45,42,38,0.4)", fontSize: 12, fontFamily: "monospace",
                      marginTop: 20 },
  poster:           { width: "100%", borderRadius: 6, aspectRatio: "2/3", objectFit: "cover" },
  posterPlaceholder:{ width: "100%", aspectRatio: "2/3", display: "flex", alignItems: "center",
                      justifyContent: "center", background: "rgba(0,0,0,0.03)",
                      borderRadius: 6, fontSize: 40 },
  title:            { color: "#2d2a26", fontSize: 16, fontFamily: "'Playfair Display', serif",
                      lineHeight: 1.3 },
  tmdbLink:         { color: "#c47e2a", fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                      textDecoration: "none", marginTop: -6, marginBottom: 4 },
  meta:             { display: "flex", gap: 10, alignItems: "center",
                      color: "rgba(45,42,38,0.45)", fontSize: 12, fontFamily: "monospace" },
  rating:           { color: "#c47e2a" },
  genreRow:         { display: "flex", flexWrap: "wrap", gap: 6 },
  genrePill:        { fontSize: 11, fontFamily: "'DM Sans', sans-serif", borderRadius: 20,
                      padding: "3px 10px", background: "rgba(196,126,42,0.12)",
                      color: "#c47e2a" },
  note:             { color: "rgba(45,42,38,0.4)", fontSize: 11,
                      fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" },
  metaExtra:        { display: "flex", flexDirection: "column", gap: 3,
                      color: "rgba(45,42,38,0.45)", fontSize: 11, fontFamily: "monospace" },
  castRow:          { display: "flex", flexDirection: "column", gap: 3 },
  ratingsRow:       { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 },
  ratingItem:       { display: "flex", alignItems: "center", gap: 4, fontSize: 12,
                      fontFamily: "'DM Sans', sans-serif" },
  iconMetaRow:      { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 2 },
  iconMetaItem:     { fontSize: 11, fontFamily: "'DM Sans', sans-serif",
                      display: "flex", alignItems: "center", gap: 3 },
  castLabel:        { color: "rgba(45,42,38,0.35)", fontSize: 10, fontFamily: "monospace",
                      textTransform: "uppercase", letterSpacing: "0.05em" },
  castName:         { color: "rgba(45,42,38,0.65)", fontSize: 12,
                      fontFamily: "'DM Sans', sans-serif" },
  plotWrap:         { marginTop: 2, maxHeight: 180, overflowY: "auto",
                      paddingRight: 4 },
  plotText:         { color: "rgba(45,42,38,0.65)", fontSize: 12,
                      fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, margin: 0 },
  moreBtn:          { marginTop: 4, padding: "8px 12px", borderRadius: 6, border: "1px solid",
                      fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                      background: "transparent", textAlign: "center" },
  providerRow:      { display: "flex", flexDirection: "column", gap: 3 },
  providerWrap:     { display: "flex", flexWrap: "wrap", gap: 6 },
  providerPill:     { fontSize: 10, fontFamily: "'DM Sans', sans-serif", borderRadius: 20,
                      padding: "2px 8px", background: "rgba(196,126,42,0.12)",
                      color: "#c47e2a" },
}
