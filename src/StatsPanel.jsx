import { useMemo } from "react"

function Histogram({ title, buckets, maxCount, theme }) {
  const t = theme ?? {}
  const barColor = t.accent ?? "#c4a882"
  const barBg    = t.border ?? "rgba(0,0,0,0.04)"
  const labelColor = t.textMuted ?? "#8a8278"
  const headColor  = t.text ?? "#5c564e"
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: headColor, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {buckets.map(({ label, count }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 40, fontSize: 10, color: labelColor, fontFamily: "monospace", textAlign: "right" }}>
              {label}
            </span>
            <div style={{ flex: 1, height: 14, background: barBg, borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{ height: "100%",
                  width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%`,
                  background: barColor + "88", borderRadius: 3, transition: "width 0.3s ease" }}
              />
            </div>
            <span style={{ width: 24, fontSize: 10, color: labelColor, fontFamily: "monospace", textAlign: "right" }}>
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatsPanel({ graphData, theme, onClose, filterHighlightIds }) {
  const t = theme ?? { surface: "#fdfbf7", border: "rgba(0,0,0,0.06)", text: "#2d2a26", textMuted: "#8a8278", textFaint: "rgba(45,42,38,0.35)", accent: "#c47e2a" }
  const stats = useMemo(() => {
    const nodes = graphData.nodes
    const links = graphData.links

    // focused vs faded
    const fadedCount = filterHighlightIds !== null
      ? nodes.filter(n => !filterHighlightIds.has(n.id)).length
      : 0

    // degree distribution
    const degMap = new Map()
    nodes.forEach(n => degMap.set(n.id, 0))
    links.forEach(l => {
      const s = typeof l.source === "object" ? l.source.id : l.source
      const t = typeof l.target === "object" ? l.target.id : l.target
      degMap.set(s, (degMap.get(s) ?? 0) + 1)
      degMap.set(t, (degMap.get(t) ?? 0) + 1)
    })
    const degrees = [...degMap.values()]
    const degreeBuckets = [
      { label: "1", count: 0 },
      { label: "2", count: 0 },
      { label: "3", count: 0 },
      { label: "4", count: 0 },
      { label: "5", count: 0 },
      { label: "6+", count: 0 },
    ]
    degrees.forEach(d => {
      if (d >= 6) degreeBuckets[5].count++
      else if (d >= 1) degreeBuckets[d - 1].count++
    })
    const maxDeg = Math.max(1, ...degreeBuckets.map(b => b.count))

    // edge weight distribution
    const weightBuckets = [
      { label: "0–10", count: 0 },
      { label: "11–20", count: 0 },
      { label: "21–30", count: 0 },
      { label: "31–40", count: 0 },
      { label: "41+", count: 0 },
    ]
    links.forEach(l => {
      const s = l.strength ?? 0
      if (s >= 41) weightBuckets[4].count++
      else if (s >= 31) weightBuckets[3].count++
      else if (s >= 21) weightBuckets[2].count++
      else if (s >= 11) weightBuckets[1].count++
      else weightBuckets[0].count++
    })
    const maxWeight = Math.max(1, ...weightBuckets.map(b => b.count))

    // genre distribution (for histogram)
    const genreCounts = new Map()
    nodes.forEach(n => {
      n.genres?.forEach(g => genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1))
    })
    const genreBuckets = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => ({ label: genre, count }))
    const maxGenre = Math.max(1, ...genreBuckets.map(b => b.count))

    // year / decade distribution
    const decadeMap = new Map()
    nodes.forEach(n => {
      if (n.year) {
        const decade = Math.floor(n.year / 10) * 10
        decadeMap.set(decade, (decadeMap.get(decade) ?? 0) + 1)
      }
    })
    const yearBuckets = [...decadeMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([decade, count]) => ({ label: `${decade}s`, count }))
    const maxYear = Math.max(1, ...yearBuckets.map(b => b.count))

    return {
      nodeCount: nodes.length,
      edgeCount: links.length,
      fadedCount,
      degreeBuckets,
      maxDeg,
      weightBuckets,
      maxWeight,
      genreBuckets,
      maxGenre,
      yearBuckets,
      maxYear,
    }
  }, [graphData, filterHighlightIds])

  return (
    <div style={{ ...s.panel, background: t.surface, borderRight: `1px solid ${t.border}` }}>
      <button style={{ ...s.collapseBtn, background: t.surface, borderColor: t.border, color: t.textMuted }} onClick={onClose} title="Hide stats">◄</button>

      <div style={{ ...s.title, color: t.text }}>Network stats</div>

      <div style={s.row}>
        <span style={{ ...s.label, color: t.textMuted }}>Movies</span>
        <span style={{ ...s.value, color: t.text }}>
          {stats.nodeCount - stats.fadedCount}
          {stats.fadedCount > 0 && (
            <span style={{ color: t.textFaint, fontSize: 10 }}> (+{stats.fadedCount} faded)</span>
          )}
        </span>
      </div>
      <div style={s.row}>
        <span style={{ ...s.label, color: t.textMuted }}>Connections</span>
        <span style={{ ...s.value, color: t.text }}>{stats.edgeCount}</span>
      </div>

      <div style={{ height: 1, background: t.border, margin: "12px 0" }} />

      <Histogram theme={t} title="Node degree" buckets={stats.degreeBuckets} maxCount={stats.maxDeg} />
      <Histogram theme={t} title="Edge weight (Similarity)" buckets={stats.weightBuckets} maxCount={stats.maxWeight} />

      {stats.yearBuckets.length > 0 && (
        <Histogram theme={t} title="Release decade" buckets={stats.yearBuckets} maxCount={stats.maxYear} />
      )}

      {stats.genreBuckets.length > 0 && (
        <Histogram theme={t} title="Top genres" buckets={stats.genreBuckets} maxCount={stats.maxGenre} />
      )}
    </div>
  )
}

const s = {
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 240,
    zIndex: 10,
    background: "#fdfbf7",
    borderRight: "1px solid rgba(0,0,0,0.06)",
    padding: "60px 18px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    overflowY: "auto",
  },
  collapseBtn: {
    position: "absolute",
    top: 16,
    right: 0,
    background: "#fdfbf7",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRight: "none",
    borderRadius: "6px 0 0 6px",
    padding: "10px 4px",
    color: "#8a8278",
    fontSize: 12,
    cursor: "pointer",
    lineHeight: 1,
    zIndex: 11,
  },
  title: {
    color: "#2d2a26",
    fontSize: 15,
    fontFamily: "'Playfair Display', serif",
    marginBottom: 12,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: 4,
  },
  label: {
    color: "#8a8278",
  },
  value: {
    color: "#2d2a26",
    fontFamily: "monospace",
    fontWeight: 600,
  },
}
