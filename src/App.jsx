import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import ForceGraph2D from "react-force-graph-2d"
import Slider from "rc-slider"
import "rc-slider/assets/index.css"
import MoviePanel from "./MoviePanel"
import ContextMenu from "./ContextMenu"
import StatsPanel from "./StatsPanel"
import { fetchMovieData, searchMovies, fetchMovieExtras } from "./tmdbApi"

// ── Theme definitions ─────────────────────────────────────────────────────────
const THEMES = {
  light: {
    bg:          "#f5f0e8",
    surface:     "#fdfbf7",
    border:      "rgba(0,0,0,0.06)",
    text:        "#2d2a26",
    textMuted:   "rgba(45,42,38,0.45)",
    textFaint:   "rgba(45,42,38,0.35)",
    accent:      "#c47e2a",
    accentBg:    "rgba(196,126,42,0.15)",
    accentBorder:"rgba(196,126,42,0.4)",
    pill:        "rgba(255,255,255,0.5)",
    pillBorder:  "rgba(45,42,38,0.1)",
    pillText:    "rgba(45,42,38,0.6)",
    headerBg:    "linear-gradient(to bottom, rgba(245,240,232,0.98) 60%, transparent)",
    inputBg:     "rgba(255,255,255,0.6)",
    inputBorder: "rgba(196,126,42,0.25)",
    dropdownBg:  "#fff",
    nodeLabel:   "rgba(45,42,38,0.75)",
    linkColor:   "rgba(45,42,38,0.18)",
    linkHover:   "rgba(196,126,42,0.65)",
    pinDot:      "#2d2a26",
    emptyIcon:   "rgba(196,126,42,0.25)",
    emptyText:   "rgba(45,42,38,0.35)",
    tooltipBg:   "rgba(255,255,255,0.95)",
    tabBg:       "#fdfbf7",
  },
  dark: {
    bg:          "#1a1917",
    surface:     "#252321",
    border:      "rgba(255,255,255,0.08)",
    text:        "#e8e4de",
    textMuted:   "rgba(232,228,222,0.45)",
    textFaint:   "rgba(232,228,222,0.3)",
    accent:      "#d4943a",
    accentBg:    "rgba(212,148,58,0.15)",
    accentBorder:"rgba(212,148,58,0.4)",
    pill:        "rgba(255,255,255,0.06)",
    pillBorder:  "rgba(255,255,255,0.1)",
    pillText:    "rgba(232,228,222,0.6)",
    headerBg:    "linear-gradient(to bottom, rgba(26,25,23,0.98) 60%, transparent)",
    inputBg:     "rgba(255,255,255,0.06)",
    inputBorder: "rgba(212,148,58,0.3)",
    dropdownBg:  "#252321",
    nodeLabel:   "rgba(232,228,222,0.75)",
    linkColor:   "rgba(232,228,222,0.12)",
    linkHover:   "rgba(212,148,58,0.65)",
    pinDot:      "#1a1917",
    emptyIcon:   "rgba(212,148,58,0.25)",
    emptyText:   "rgba(232,228,222,0.35)",
    tooltipBg:   "rgba(37,35,33,0.97)",
    tabBg:       "#252321",
  },
}

// ── Genre colour palette ──────────────────────────────────────────────────────
const GENRE_COLORS = {
  Action:      "#ef4444", Adventure:   "#f97316", Animation:   "#eab308",
  Comedy:      "#84cc16", Crime:       "#06b6d4", Documentary: "#64748b",
  Drama:       "#8b5cf6", Fantasy:     "#d946ef", Horror:      "#f43f5e",
  Mystery:     "#0ea5e9", Romance:     "#ec4899", "Sci-Fi":    "#6366f1",
  Thriller:    "#f59e0b", War:         "#78716c", Western:     "#a16207",
  _default:    "#4ab3f4",
}
function genreColor(genres) {
  if (!genres?.length) return GENRE_COLORS._default
  return GENRE_COLORS[genres[0]] ?? GENRE_COLORS._default
}

// ── Year / decade colour scale ────────────────────────────────────────────────
const DECADE_COLORS = {
  1900: "#94a3b8", 1910: "#94a3b8", 1920: "#94a3b8", 1930: "#94a3b8",
  1940: "#a78bfa", 1950: "#818cf8", 1960: "#38bdf8", 1970: "#34d399",
  1980: "#4ade80", 1990: "#facc15", 2000: "#fb923c", 2010: "#f87171",
  2020: "#f43f5e", _default: "#4ab3f4",
}
function yearColor(year) {
  if (!year) return DECADE_COLORS._default
  return DECADE_COLORS[Math.floor(year / 10) * 10] ?? DECADE_COLORS._default
}

const COLOR_MODES = [
  { id: "genre", label: "Genre" },
  { id: "year",  label: "Year"  },
]

// ── Seed movies for "Surprise me" ─────────────────────────────────────────────
const SEED_MOVIES = [
  { id: "603",    title: "The Matrix",        genres: ["Sci-Fi","Action"]     },
  { id: "27205",  title: "Inception",          genres: ["Sci-Fi","Thriller"]   },
  { id: "157336", title: "Interstellar",       genres: ["Sci-Fi","Drama"]      },
  { id: "155",    title: "The Dark Knight",    genres: ["Action","Crime"]      },
  { id: "13",     title: "Forrest Gump",       genres: ["Drama","Romance"]     },
  { id: "550",    title: "Fight Club",         genres: ["Drama","Thriller"]    },
  { id: "680",    title: "Pulp Fiction",       genres: ["Crime","Drama"]       },
  { id: "120",    title: "The Lord of the Rings: The Fellowship of the Ring", genres: ["Adventure","Fantasy"] },
]

// ── URL hash helpers ──────────────────────────────────────────────────────────
function encodeHash(ids) {
  if (!ids || ids.size === 0) return ""
  return "#ids=" + [...ids].join(",")
}
function decodeHash() {
  const hash = window.location.hash
  if (!hash.startsWith("#ids=")) return []
  return hash.slice(5).split(",").filter(Boolean)
}

// ── Point-in-polygon (ray-casting) ────────────────────────────────────────────
function pointInPolygon(x, y, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// ── Main component ────────────────────────────────────────────────────────────
export default function App() {
  const [darkMode,       setDarkMode]        = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false)
  const [movieIndex,     setMovieIndex]      = useState([])
  const [indexLoading,   setIndexLoading]    = useState(true)
  const [query,          setQuery]           = useState("")
  const [suggestions,    setSuggestions]     = useState([])
  const [searchIdx,      setSearchIdx]       = useState(-1)
  const [graphData,      setGraphData]       = useState({ nodes: [], links: [] })
  const [loadedIds,      setLoadedIds]       = useState(new Set())
  const [hoveredNode,    setHoveredNode]     = useState(null)
  const [selectedNode,   setSelectedNode]    = useState(null)
  const [loading,        setLoading]         = useState(false)
  const [detailLoading,  setDetailLoading]   = useState(false)
  const [activeGenres,   setActiveGenres]    = useState(new Set())
  const [activeDecade,   setActiveDecade]    = useState(null)
  const [voteAvgRange,   setVoteAvgRange]    = useState([0, 10])
  const [runtimeRange,   setRuntimeRange]    = useState([0, 300])
  const [colorMode,      setColorMode]       = useState("year")   // default: year
  const [sizeMode,       setSizeMode]        = useState("default")
  const [maxNeighbors,   setMaxNeighbors]    = useState(10)
  const [graphWidth,     setGraphWidth]      = useState(window.innerWidth)
  const [pinnedIds,      setPinnedIds]       = useState(new Set())
  const [contextMenu,    setContextMenu]     = useState(null)
  const [statsVisible,   setStatsVisible]    = useState(false)
  const [panelUserClosed,setPanelUserClosed] = useState(false)
  const [panelHasNew,    setPanelHasNew]     = useState(false)
  const [selectedNodeVersion, setSelectedNodeVersion] = useState(0)
  const [tooltipPos,     setTooltipPos]      = useState({ x: 0, y: 0 })
  const [history,        setHistory]         = useState([])
  const [future,         setFuture]          = useState([])
  const [chargeStrength, setChargeStrength]  = useState(-350)
  const [offscreenArrows,setOffscreenArrows] = useState([])   // [{angle, ex, ey}]
  const [hashRestored,   setHashRestored]    = useState(false)
  const [lassoMode,      setLassoMode]       = useState(false)
  const [lassoActive,    setLassoActive]     = useState(false)
  const [lassoPoints,    setLassoPoints]     = useState([])
  const [helpOpen,       setHelpOpen]        = useState(false)
  const [aboutOpen,      setAboutOpen]       = useState(false)
  const [moreDetailsOpen,setMoreDetailsOpen] = useState(false)
  const [cmdOpen,        setCmdOpen]         = useState(false)
  const [hasEverSelectedNode, setHasEverSelectedNode] = useState(false)

  const yearCache        = useRef(new Map())
  const mousePosRef      = useRef({ x: 0, y: 0 })
  const movieIndexMapRef = useRef(new Map())
  const lastBgClickRef   = useRef(0)
  const fgRef            = useRef()
  const searchInputRef   = useRef()
  const expandNodeRef    = useRef()
  const expandAllRef     = useRef()
  const particlesRef     = useRef(null)

  const theme  = THEMES[darkMode ? "dark" : "light"]
  const accent = theme.accent

  const panelOpen = !!selectedNode && !panelUserClosed

  // ── Notify tab when panel has new content while closed ─────────────────────
  useEffect(() => {
    if (panelUserClosed && selectedNode) setPanelHasNew(true)
  }, [selectedNodeVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!panelUserClosed) setPanelHasNew(false)
  }, [panelUserClosed])

  // Auto-clear panel new-content pulse after a few seconds
  useEffect(() => {
    if (!panelHasNew) return
    const t = setTimeout(() => setPanelHasNew(false), 4000)
    return () => clearTimeout(t)
  }, [panelHasNew])

  // Auto-open both side panels on first node selection
  useEffect(() => {
    if (selectedNode && !hasEverSelectedNode) {
      setHasEverSelectedNode(true)
      setStatsVisible(true)
      setPanelUserClosed(false)
    }
  }, [selectedNode, hasEverSelectedNode])

  // ── Resize ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      let w = window.innerWidth
      if (panelOpen)    w -= 280
      if (statsVisible) w -= 240
      setGraphWidth(w)
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [panelOpen, statsVisible])

  // ── Load index ──────────────────────────────────────────────────────────────
  // No static index needed; we search TMDB on-the-fly.
  useEffect(() => {
    setMovieIndex([])
    setIndexLoading(false)
  }, [])

  // ── Keep lookup map in sync ─────────────────────────────────────────────────
  useEffect(() => {
    const m = new Map()
    movieIndex.forEach(e => m.set(String(e.id), e.title))
    movieIndexMapRef.current = m
  }, [movieIndex])

  // ── d3 forces ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force("charge")?.strength(chargeStrength)
    fg.d3Force("link")?.distance(80)
    fg.d3ReheatSimulation()
  }, [chargeStrength])

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force("charge")?.strength(chargeStrength)
    fg.d3Force("link")?.distance(80)
  })

  // ── Lazy year fetch for tooltip ─────────────────────────────────────────────
  useEffect(() => {
    if (!hoveredNode || hoveredNode.year) return
    const id = hoveredNode.id
    if (yearCache.current.has(id)) return
    fetchMovieData(id).then(d => {
      const y = d.meta?.year
      if (y) {
        yearCache.current.set(id, y)
        setHoveredNode(prev => prev?.id === id ? { ...prev, year: y } : prev)
      }
    }).catch(() => {})
  }, [hoveredNode])

  // ── Cursor ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = document.querySelector(".force-graph-container canvas")
    if (el) el.style.cursor = hoveredNode ? "pointer" : "grab"
  }, [hoveredNode])

  // ── Offscreen directional arrows ────────────────────────────────────────────
  useEffect(() => {
    if (!graphData.nodes.length) { setOffscreenArrows([]); return }
    let raf
    const tick = () => {
      if (!fgRef.current) { raf = requestAnimationFrame(tick); return }
      const W  = graphWidth
      const H  = window.innerHeight
      const cx = W / 2
      const cy = H / 2
      const margin = 32

      const arrows = []
      graphData.nodes.forEach(n => {
        try {
          const sc = fgRef.current.graph2ScreenCoords(n.x ?? 0, n.y ?? 0)
          if (sc.x >= 0 && sc.x <= W && sc.y >= 0 && sc.y <= H) return
          const angle = Math.atan2(sc.y - cy, sc.x - cx)
          const cos = Math.cos(angle)
          const sin = Math.sin(angle)
          const hw  = cx - margin
          const hh  = cy - margin
          if (hw <= 0 || hh <= 0) return
          let ex, ey
          if (Math.abs(cos) * hh > Math.abs(sin) * hw) {
            const sign = cos > 0 ? 1 : -1
            ex = cx + sign * hw
            ey = cy + sign * hw * sin / (cos || 0.001)
          } else {
            const sign = sin > 0 ? 1 : -1
            ey = cy + sign * hh
            ex = cx + sign * hh * cos / (sin || 0.001)
          }
          arrows.push({ id: n.id, angle, ex, ey })
        } catch (_) {}
      })

      setOffscreenArrows(arrows)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [graphData.nodes, graphWidth])

  // ── URL hash: restore on mount (only after index loads) ────────────────────
  useEffect(() => {
    if (hashRestored || indexLoading) return
    const ids = decodeHash()
    setHashRestored(true)
    if (ids.length === 0) return
    ids.forEach(id => {
      const title = movieIndex.find(m => String(m.id) === String(id))?.title ?? id
      expandNodeRaw(String(id), title, /* skipHistory */ true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexLoading, hashRestored, movieIndex])

  // ── URL hash: sync after restore (don't overwrite hash before reading it) ──
  useEffect(() => {
    if (!hashRestored) return
    window.history.replaceState(null, "", encodeHash(loadedIds) || location.pathname)
  }, [loadedIds, hashRestored])

  // ── Escape key ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (e.key !== "Escape") return
      if (cmdOpen)         { setCmdOpen(false);         return }
      if (moreDetailsOpen) { setMoreDetailsOpen(false); return }
      if (helpOpen)        { setHelpOpen(false);        return }
      if (aboutOpen)       { setAboutOpen(false);       return }
      if (lassoMode)       { setLassoMode(false); setLassoActive(false); setLassoPoints([]); return }
      if (contextMenu)     { setContextMenu(null);      return }
      if (statsVisible)    { setStatsVisible(false);    return }
      if (panelOpen)       { setPanelUserClosed(true);  return }
      if (query)           { setQuery(""); setSuggestions([]); return }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [lassoMode, contextMenu, panelOpen, query, helpOpen, aboutOpen, moreDetailsOpen, cmdOpen])

  // ── Hotkeys: /, d, m, Ctrl+K ────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      const tag = e.target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.ctrlKey && e.key === "k") { e.preventDefault(); setCmdOpen(v => !v); return }
      if (e.key === "/")  { e.preventDefault(); searchInputRef.current?.focus(); return }
      if (e.key === "d")  { setStatsVisible(v => !v); return }
      if (e.key === "m" && selectedNode) { setPanelUserClosed(v => !v); return }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [selectedNode])

  // ── Touch gestures: 2-finger slide = pan, pinch = zoom ─────────────────────
  useEffect(() => {
    const canvas = document.querySelector(".force-graph-container canvas")
    if (!canvas) return
    const container = canvas.parentElement
    if (!container) return

    let touchStart = []
    let startK = 1
    let startX = 0, startY = 0

    const onTouchStart = (e) => {
      if (e.touches.length !== 2) return
      touchStart = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }))
      const fg = fgRef.current
      if (!fg) return
      startK = fg.zoom()
      const c = fg.centerAt()
      startX = c.x; startY = c.y
    }

    const onTouchMove = (e) => {
      if (e.touches.length !== 2 || touchStart.length !== 2) return
      e.preventDefault()
      const t0 = e.touches[0], t1 = e.touches[1]
      const s0 = touchStart[0], s1 = touchStart[1]
      const fg = fgRef.current
      if (!fg) return

      const distStart = Math.hypot(s1.x - s0.x, s1.y - s0.y)
      const distNow = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
      const dx0 = t0.clientX - s0.x, dy0 = t0.clientY - s0.y
      const dx1 = t1.clientX - s1.x, dy1 = t1.clientY - s1.y

      const sameDir = (dx0 * dx1 + dy0 * dy1) > 0
      const pinchRatio = distNow / (distStart || 1)

      if (sameDir && Math.abs(pinchRatio - 1) < 0.15) {
        const avgDx = (dx0 + dx1) / 2
        const avgDy = (dy0 + dy1) / 2
        const k = fg.zoom()
        fg.centerAt(startX - avgDx / k, startY - avgDy / k)
      } else {
        const newK = Math.max(0.1, Math.min(10, startK * pinchRatio))
        fg.zoom(newK)
      }
    }

    const onTouchEnd = () => { touchStart = [] }

    container.addEventListener("touchstart", onTouchStart, { passive: false })
    container.addEventListener("touchmove", onTouchMove, { passive: false })
    container.addEventListener("touchend", onTouchEnd)
    return () => {
      container.removeEventListener("touchstart", onTouchStart)
      container.removeEventListener("touchmove", onTouchMove)
      container.removeEventListener("touchend", onTouchEnd)
    }
  }, [])

  // ── Pill data ───────────────────────────────────────────────────────────────
  const allGenres = useMemo(() => {
    const g = new Set()
    graphData.nodes.forEach(n => n.genres?.forEach(genre => g.add(genre)))
    return [...g].sort()
  }, [graphData.nodes])

  const allDecades = useMemo(() => {
    const d = new Set()
    graphData.nodes.forEach(n => { if (n.year) d.add(Math.floor(n.year / 10) * 10) })
    return [...d].sort()
  }, [graphData.nodes])

  const voteAvgBounds = useMemo(() => {
    const vals = graphData.nodes.map(n => n.vote_avg).filter(v => v != null)
    return vals.length ? [Math.floor(Math.min(...vals)), Math.ceil(Math.max(...vals))] : [0, 10]
  }, [graphData.nodes])

  const runtimeBounds = useMemo(() => {
    const vals = graphData.nodes.map(n => n.runtime).filter(v => v != null && v > 0)
    return vals.length ? [Math.floor(Math.min(...vals)), Math.ceil(Math.max(...vals))] : [0, 300]
  }, [graphData.nodes])

  // Clamp range filters when data bounds change
  useEffect(() => {
    setVoteAvgRange(prev => [
      Math.max(prev[0], voteAvgBounds[0]),
      Math.min(prev[1], voteAvgBounds[1]),
    ])
  }, [voteAvgBounds[0], voteAvgBounds[1]])

  useEffect(() => {
    setRuntimeRange(prev => [
      Math.max(prev[0], runtimeBounds[0]),
      Math.min(prev[1], runtimeBounds[1]),
    ])
  }, [runtimeBounds[0], runtimeBounds[1]])

  // Auto-expand ranges when new nodes have values outside current range
  useEffect(() => {
    const voteAvgs = graphData.nodes.map(n => n.vote_avg).filter(v => v != null)
    if (voteAvgs.length) {
      const minVa = Math.min(...voteAvgs)
      const maxVa = Math.max(...voteAvgs)
      setVoteAvgRange(prev => [
        Math.min(prev[0], minVa),
        Math.max(prev[1], maxVa),
      ])
    }
    const runtimes = graphData.nodes.map(n => n.runtime).filter(v => v != null && v > 0)
    if (runtimes.length) {
      const minRt = Math.min(...runtimes)
      const maxRt = Math.max(...runtimes)
      setRuntimeRange(prev => [
        Math.min(prev[0], minRt),
        Math.max(prev[1], maxRt),
      ])
    }
  }, [graphData.nodes.length])

  // ── Which nodes pass the active filter (for highlighting, not removal) ──────
  const filterHighlightIds = useMemo(() => {
    const noFilters = activeGenres.size === 0 && activeDecade === null
      && voteAvgRange[0] <= voteAvgBounds[0] && voteAvgRange[1] >= voteAvgBounds[1]
      && runtimeRange[0] <= runtimeBounds[0] && runtimeRange[1] >= runtimeBounds[1]
    if (noFilters) return null  // null = all
    const ids = new Set()
    graphData.nodes.forEach(n => {
      const genreOk  = activeGenres.size === 0 || n.genres?.some(g => activeGenres.has(g))
      const decadeOk = activeDecade === null    || (n.year && Math.floor(n.year / 10) * 10 === activeDecade)
      // Missing vote_avg / runtime = "unknown", always passes that filter
      const voteOk   = n.vote_avg == null || (n.vote_avg >= voteAvgRange[0] && n.vote_avg <= voteAvgRange[1])
      const runtimeOk = n.runtime == null  || (n.runtime >= runtimeRange[0] && n.runtime <= runtimeRange[1])
      if (genreOk && decadeOk && voteOk && runtimeOk) ids.add(n.id)
    })
    return ids
  }, [graphData.nodes, activeGenres, activeDecade, voteAvgRange, runtimeRange, voteAvgBounds, runtimeBounds])

  // ── Force canvas redraw when filter highlight changes ───────────────────────
  useEffect(() => {
    const fg = fgRef.current
    if (fg && typeof fg.refresh === "function") {
      fg.refresh()
    }
  }, [filterHighlightIds])

  // ── Hovered-node neighbor set ───────────────────────────────────────────────
  const hoveredNeighborIds = useMemo(() => {
    if (!hoveredNode) return new Set()
    const ids = new Set()
    graphData.links.forEach(l => {
      const s = typeof l.source === "object" ? l.source.id : l.source
      const t = typeof l.target === "object" ? l.target.id : l.target
      if (s === hoveredNode.id) ids.add(t)
      if (t === hoveredNode.id) ids.add(s)
    })
    return ids
  }, [hoveredNode, graphData.links])

  const toggleGenre = genre => {
    setActiveGenres(prev => { const next = new Set(prev); next.has(genre) ? next.delete(genre) : next.add(genre); return next })
  }

  // ── Visible graph (top-N links + hide unconnected nodes) ────────────────────
  const visibleGraph = useMemo(() => {
    const bySrc = new Map()
    graphData.links.forEach(l => {
      const s = typeof l.source === "object" ? l.source.id : l.source
      if (!bySrc.has(s)) bySrc.set(s, [])
      bySrc.get(s).push(l)
    })
    const topLinks = []
    bySrc.forEach(ls => {
      topLinks.push(...[...ls].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0)).slice(0, maxNeighbors))
    })
    const connectedIds = new Set()
    topLinks.forEach(l => {
      const s = typeof l.source === "object" ? l.source.id : l.source
      const t = typeof l.target === "object" ? l.target.id : l.target
      connectedIds.add(String(s)); connectedIds.add(String(t))
    })
    const visibleNodes = graphData.nodes.filter(n =>
      connectedIds.has(String(n.id)) || n.isRoot || loadedIds.has(String(n.id))
    )
    return { nodes: visibleNodes, links: topLinks }
  }, [graphData, maxNeighbors, loadedIds])

  // ── Degree map ──────────────────────────────────────────────────────────────
  const nodeDegrees = useMemo(() => {
    const deg = new Map()
    graphData.nodes.forEach(n => deg.set(n.id, 0))
    graphData.links.forEach(l => {
      const s = typeof l.source === "object" ? l.source.id : l.source
      const t = typeof l.target === "object" ? l.target.id : l.target
      deg.set(s, (deg.get(s) ?? 0) + 1)
      deg.set(t, (deg.get(t) ?? 0) + 1)
    })
    return deg
  }, [graphData])
  const maxDeg = useMemo(() => Math.max(1, ...(nodeDegrees.size ? nodeDegrees.values() : [1])), [nodeDegrees])

  // ── Avg similarity per node ─────────────────────────────────────────────────
  const nodeAvgSim = useMemo(() => {
    const acc = new Map(), cnt = new Map()
    graphData.nodes.forEach(n => { acc.set(n.id, 0); cnt.set(n.id, 0) })
    graphData.links.forEach(l => {
      const s = typeof l.source === "object" ? l.source.id : l.source
      const t = typeof l.target === "object" ? l.target.id : l.target
      const v = l.strength ?? 0
      acc.set(s, (acc.get(s) ?? 0) + v); cnt.set(s, (cnt.get(s) ?? 0) + 1)
      acc.set(t, (acc.get(t) ?? 0) + v); cnt.set(t, (cnt.get(t) ?? 0) + 1)
    })
    const avg = new Map()
    acc.forEach((sum, id) => avg.set(id, sum / (cnt.get(id) ?? 1)))
    return avg
  }, [graphData])
  const maxAvgSim = useMemo(() => Math.max(1, ...(nodeAvgSim.size ? nodeAvgSim.values() : [1])), [nodeAvgSim])

  // ── Search suggestions (live TMDB search) ───────────────────────────────────
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); setSearchIdx(-1); return }
    const timer = setTimeout(async () => {
      try {
        const results = await searchMovies(query)
        setSuggestions(results.slice(0, 8))
      } catch (e) {
        console.warn("Search failed:", e)
        setSuggestions([])
      }
      setSearchIdx(-1)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  // ── History helpers ─────────────────────────────────────────────────────────
  const snapshot = useCallback(() => ({
    graphData: {
      nodes: graphData.nodes.map(n => ({ ...n })),
      // normalize links back to plain IDs so d3 can re-resolve them after restore
      links: graphData.links.map(l => ({
        source:   typeof l.source === "object" ? l.source.id : l.source,
        target:   typeof l.target === "object" ? l.target.id : l.target,
        strength: l.strength,
      })),
    },
    loadedIds: new Set(loadedIds),
  }), [graphData, loadedIds])

  const pushHistory = useCallback(() => {
    setHistory(prev => [...prev, snapshot()])
    setFuture([])
  }, [snapshot])

  // ── Core expand ─────────────────────────────────────────────────────────────
  const expandNodeRaw = useCallback(async (movieId, movieTitle, skipHistory = false) => {
    movieId = String(movieId)
    let tmdbId = movieId
    let meta = null

    if (!loadedIds.has(movieId)) {
      if (!skipHistory) pushHistory()
      setLoading(true)
      setLoadedIds(prev => new Set([...prev, movieId]))

      let data
      try { data = await fetchMovieData(movieId) }
      catch (e) { console.warn(e); setLoading(false); return }

      meta = data.meta
      const { neighbors } = data
      tmdbId = meta.tmdb_id ?? movieId
      setSelectedNode({ id: movieId, ...meta })
      setSelectedNodeVersion(v => v + 1)

      setGraphData(prev => {
        const existingIds  = new Set(prev.nodes.map(n => String(n.id)))
        const existingKeys = new Set(prev.links.map(l => {
          const s = typeof l.source === "object" ? l.source.id : l.source
          const t = typeof l.target === "object" ? l.target.id : l.target
          return `${String(s)}__${String(t)}`
        }))
        const newNodes = [...prev.nodes]
        const newLinks = [...prev.links]
        const isFirstNode = newNodes.length === 0

        if (!existingIds.has(movieId)) {
          newNodes.push({ id: movieId, title: meta.title || movieIndexMapRef.current.get(String(movieId)) || movieTitle || movieId, genres: meta.genres ?? [], year: meta.year, poster: meta.poster, overview: meta.overview, vote_avg: meta.vote_avg, runtime: meta.runtime, tmdb_id: meta.tmdb_id ?? movieId, imdb_id: meta.imdb_id, isRoot: isFirstNode })
          existingIds.add(movieId)
        } else {
          const n = newNodes.find(n => String(n.id) === movieId)
          if (n) Object.assign(n, { title: meta.title || n.title, genres: meta.genres ?? [], year: meta.year, poster: meta.poster, overview: meta.overview, vote_avg: meta.vote_avg, runtime: meta.runtime, tmdb_id: meta.tmdb_id ?? movieId, imdb_id: meta.imdb_id })
          if (isFirstNode && n) n.isRoot = true
        }

        for (const nb of neighbors) {
          const nbId = String(nb.id)
          if (!existingIds.has(nbId)) {
            newNodes.push({ id: nbId, title: nb.title || movieIndexMapRef.current.get(nbId) || nbId, genres: nb.genres ?? [], year: nb.year ?? null, snn: nb.snn, vote_avg: nb.vote_avg, runtime: nb.runtime, tmdb_id: nb.tmdb_id ?? nbId })
            existingIds.add(nbId)
          }
          const key = `${movieId}__${nbId}`, keyRev = `${nbId}__${movieId}`
          if (!existingKeys.has(key) && !existingKeys.has(keyRev)) {
            newLinks.push({ source: movieId, target: nbId, strength: nb.snn })
            existingKeys.add(key)
          }
        }

        setTimeout(() => {
          const node = newNodes.find(n => String(n.id) === movieId)
          if (node && fgRef.current) fgRef.current.centerAt(node.x ?? 0, node.y ?? 0, 600)
        }, 800)

        return { nodes: newNodes, links: newLinks }
      })
      setLoading(false)
    } else {
      const node = graphData.nodes.find(n => String(n.id) === movieId)
      tmdbId = node?.tmdb_id ?? movieId
      meta = node
      if (node && fgRef.current) setTimeout(() => fgRef.current?.centerAt(node.x, node.y, 600), 50)
      setSelectedNode(node ?? { id: movieId })
      setSelectedNodeVersion(v => v + 1)
    }

    // Fetch detailed metadata from TMDB on-the-fly (for both new and existing nodes)
    setDetailLoading(true)
    fetchMovieExtras(tmdbId)
      .then((extras) => {
        setSelectedNode((prev) => (prev && String(prev.id) === movieId
          ? { ...prev, ...extras }
          : prev))
        setSelectedNodeVersion((v) => v + 1)
      })
      .catch((err) => console.warn("TMDB extras failed:", err))
      .finally(() => setDetailLoading(false))
  }, [loadedIds, graphData.nodes, pushHistory])

  // Keep a fresh ref for external callers (e.g. Surprise me button)
  expandNodeRef.current = expandNodeRaw

  // ── Expand all unloaded neighbors ──────────────────────────────────────────
  const handleExpandAll = useCallback(() => {
    const unloaded = new Set()
    graphData.nodes.forEach(n => { if (!loadedIds.has(String(n.id))) unloaded.add(String(n.id)) })
    if (unloaded.size === 0) return
    pushHistory()
    unloaded.forEach(id => expandNodeRaw(id, movieIndexMapRef.current.get(id) ?? id, true))
  }, [graphData.nodes, loadedIds, expandNodeRaw, pushHistory])
  expandAllRef.current = handleExpandAll

  // ── Surprise Me: one seed movie, expand 3 levels deep ────────────────────
  const handleSurpriseMe = useCallback(() => {
    const m = SEED_MOVIES[Math.floor(Math.random() * SEED_MOVIES.length)]
    expandNodeRef.current?.(String(m.id), m.title)
    setTimeout(() => expandAllRef.current?.(), 800)
    setTimeout(() => expandAllRef.current?.(), 1600)
  }, [])

  // ── Collapse node: keep the node, remove only isolated neighbors (degree 1) ─
  const collapseNode = useCallback((nodeId) => {
    nodeId = String(nodeId)
    pushHistory()
    setGraphData(prev => {
      // Compute degree of every node before removing anything
      const degrees = new Map()
      prev.nodes.forEach(n => degrees.set(String(n.id), 0))
      prev.links.forEach(l => {
        const s = typeof l.source === "object" ? l.source.id : l.source
        const t = typeof l.target === "object" ? l.target.id : l.target
        degrees.set(String(s), (degrees.get(String(s)) ?? 0) + 1)
        degrees.set(String(t), (degrees.get(String(t)) ?? 0) + 1)
      })
      // Find isolated neighbors (degree === 1) of this node
      const isolatedNeighborIds = new Set()
      prev.links.forEach(l => {
        const s = typeof l.source === "object" ? l.source.id : l.source
        const t = typeof l.target === "object" ? l.target.id : l.target
        const sid = String(s), tid = String(t)
        if (sid === nodeId && degrees.get(tid) === 1) isolatedNeighborIds.add(tid)
        if (tid === nodeId && degrees.get(sid) === 1) isolatedNeighborIds.add(sid)
      })
      // Keep links that are NOT between nodeId and an isolated neighbor
      const remainingLinks = prev.links.filter(l => {
        const s = typeof l.source === "object" ? l.source.id : l.source
        const t = typeof l.target === "object" ? l.target.id : l.target
        const sid = String(s), tid = String(t)
        return !((sid === nodeId && isolatedNeighborIds.has(tid)) || (tid === nodeId && isolatedNeighborIds.has(sid)))
      })
      // Remove only isolated neighbors; keep nodeId and all other nodes
      const remainingNodes = prev.nodes.filter(n => !isolatedNeighborIds.has(String(n.id)))
      return { nodes: remainingNodes, links: remainingLinks }
    })
    // Keep nodeId in loadedIds so it stays visible
    setPinnedIds(prev => { const next = new Set(prev); next.delete(nodeId); return next })
  }, [pushHistory])

  // ── History navigation ──────────────────────────────────────────────────────
  const handleGoBack = useCallback(() => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setFuture(f => [{ graphData: { nodes: graphData.nodes.map(n => ({...n})), links: graphData.links.map(l => ({ source: typeof l.source==="object"?l.source.id:l.source, target: typeof l.target==="object"?l.target.id:l.target, strength: l.strength })) }, loadedIds }, ...f])
    setHistory(h => h.slice(0, -1))
    setGraphData(prev.graphData)
    setLoadedIds(prev.loadedIds)
    setPinnedIds(new Set())
    setTimeout(() => fgRef.current?.d3ReheatSimulation(), 50)
  }, [history, graphData, loadedIds])

  const handleGoForward = useCallback(() => {
    if (future.length === 0) return
    const next = future[0]
    setHistory(h => [...h, { graphData: { nodes: graphData.nodes.map(n => ({...n})), links: graphData.links.map(l => ({ source: typeof l.source==="object"?l.source.id:l.source, target: typeof l.target==="object"?l.target.id:l.target, strength: l.strength })) }, loadedIds }])
    setFuture(f => f.slice(1))
    setGraphData(next.graphData)
    setLoadedIds(next.loadedIds)
    setPinnedIds(new Set())
    setTimeout(() => fgRef.current?.d3ReheatSimulation(), 50)
  }, [future, graphData, loadedIds])

  // ── Event handlers ──────────────────────────────────────────────────────────
  const handleSelectMovie = movie => {
    setQuery(""); setSuggestions([]); setSearchIdx(-1)
    const existing = graphData.nodes.find(n => String(n.id) === String(movie.id))
    if (existing && fgRef.current) {
      fgRef.current.centerAt(existing.x, existing.y, 600)
      setSelectedNode(existing)
      return
    }
    expandNodeRaw(String(movie.id), movie.title)
  }

  const handleNodeClick = node => {
    expandNodeRaw(String(node.id), node.title)
  }

  const handleReset = () => {
    setGraphData({ nodes: [], links: [] })
    setLoadedIds(new Set())
    setHoveredNode(null)
    setSelectedNode(null)
    setPinnedIds(new Set())
    setPanelUserClosed(false)
    setPanelHasNew(false)
    setContextMenu(null)
    setActiveGenres(new Set())
    setActiveDecade(null)
    setVoteAvgRange([0, 10])
    setRuntimeRange([0, 300])
    setHistory([])
    setFuture([])
  }

  const handleSearchKeyDown = e => {
    if (!suggestions.length) return
    if (e.key === "ArrowDown")  { e.preventDefault(); setSearchIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === "ArrowUp")  { e.preventDefault(); setSearchIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === "Enter") {
      e.preventDefault()
      const target = searchIdx >= 0 ? suggestions[searchIdx] : suggestions[0]
      if (target) handleSelectMovie(target)
    }
  }

  // ── Lasso selection (free-form polygon) ─────────────────────────────────────
  const handleLassoDown = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setLassoPoints([{ x: e.clientX - rect.left, y: e.clientY - rect.top }])
    setLassoActive(true)
  }, [])

  const handleLassoMove = useCallback((e) => {
    if (!lassoActive) return
    const rect = e.currentTarget.getBoundingClientRect()
    setLassoPoints(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top }])
  }, [lassoActive])

  const handleLassoUp = useCallback((e) => {
    if (!lassoActive || lassoPoints.length < 3) { setLassoActive(false); setLassoPoints([]); return }
    const selectedIds = new Set()
    graphData.nodes.forEach(n => {
      if (n.x == null || n.y == null || !fgRef.current) return
      const sc = fgRef.current.graph2ScreenCoords(n.x, n.y)
      if (pointInPolygon(sc.x, sc.y, lassoPoints)) selectedIds.add(String(n.id))
    })
    setLassoActive(false)
    setLassoMode(false)
    setLassoPoints([])
    if (selectedIds.size === 0) return
    pushHistory()
    setGraphData(prev => {
      const newNodes = prev.nodes.filter(n => selectedIds.has(String(n.id)))
      const newLinks = prev.links.filter(l => {
        const s = typeof l.source === "object" ? l.source.id : l.source
        const t = typeof l.target === "object" ? l.target.id : l.target
        return selectedIds.has(String(s)) && selectedIds.has(String(t))
      })
      return { nodes: newNodes, links: newLinks }
    })
    setLoadedIds(prev => { const next = new Set(); prev.forEach(id => { if (selectedIds.has(String(id))) next.add(id) }); return next })
    setPinnedIds(prev => { const next = new Set(); prev.forEach(id => { if (selectedIds.has(String(id))) next.add(id) }); return next })
  }, [lassoActive, lassoPoints, graphData.nodes, pushHistory])

  // ── Node size ───────────────────────────────────────────────────────────────
  const getNodeRadius = useCallback(node => {
    if (node.isRoot) return 10
    switch (sizeMode) {
      case "degree":     return 4 + (maxDeg > 1 ? (nodeDegrees.get(node.id) ?? 0) / maxDeg * 8 : 4)
      case "similarity": return 4 + (maxAvgSim > 1 ? (nodeAvgSim.get(node.id) ?? 0) / maxAvgSim * 8 : 4)
      default:           return 5 + ((node.snn ?? 10) / 50) * 5
    }
  }, [sizeMode, nodeDegrees, maxDeg, nodeAvgSim, maxAvgSim])

  // ── Particles background: initialise once on mount ───────────────────────
  useEffect(() => {
    const W = window.innerWidth, H = window.innerHeight
    particlesRef.current = Array.from({ length: 70 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    }))
  }, [])

  // ── Draw animated particle network in screen-space ───────────────────────
  const drawParticles = useCallback((ctx) => {
    const ps = particlesRef.current
    if (!ps) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const W = graphWidth, H = window.innerHeight
    const linkDist = 130
    const base = darkMode ? '232,228,222' : '45,42,38'
    const maxA  = darkMode ? 0.18 : 0.11
    // Update positions + bounce off edges
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy
      if (p.x < 0) { p.x = 0; p.vx *= -1 }
      if (p.x > W) { p.x = W; p.vx *= -1 }
      if (p.y < 0) { p.y = 0; p.vy *= -1 }
      if (p.y > H) { p.y = H; p.vy *= -1 }
    }
    // Draw connecting lines
    ctx.lineWidth = 0.6
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y
        const d2 = dx * dx + dy * dy
        if (d2 > linkDist * linkDist) continue
        ctx.strokeStyle = `rgba(${base},${(maxA * (1 - Math.sqrt(d2) / linkDist)).toFixed(3)})`
        ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.stroke()
      }
    }
    // Draw dots
    ctx.fillStyle = `rgba(${base},${(maxA * 1.5).toFixed(3)})`
    for (const p of ps) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }, [darkMode, graphWidth])

  // ── Canvas draw ─────────────────────────────────────────────────────────────
  const drawNode = useCallback((node, ctx, globalScale) => {
    const isRoot   = node.isRoot
    const expanded = loadedIds.has(node.id)
    const radius   = getNodeRadius(node) / Math.max(0.15, Math.pow(globalScale, 1.3))

    const baseColor = isRoot ? accent : (colorMode === "year" ? yearColor(node.year) : genreColor(node.genres))

    // Compute fade alpha
    let alpha = 1
    // Filter highlight (genre/decade pills) — fade non-matching
    if (filterHighlightIds !== null && !filterHighlightIds.has(node.id)) alpha = 0.1
    // Pin highlight — fade non-pinned non-neighbors
    if (pinnedIds.size > 0 && !pinnedIds.has(node.id)) {
      const isPinnedNeighbor = visibleGraph.links.some(l => {
        const s = typeof l.source === "object" ? l.source.id : l.source
        const t = typeof l.target === "object" ? l.target.id : l.target
        return (pinnedIds.has(s) && t === node.id) || (pinnedIds.has(t) && s === node.id)
      })
      if (!isPinnedNeighbor) alpha = Math.min(alpha, 0.12)
    }

    const isFaded   = alpha < 0.3
    const isHovered = node.id === hoveredNode?.id
    const isHovNbr  = hoveredNeighborIds.has(node.id)

    ctx.globalAlpha = alpha

    // glow
    ctx.beginPath(); ctx.arc(node.x, node.y, radius * 2.8, 0, 2 * Math.PI)
    ctx.fillStyle = baseColor + "28"; ctx.fill()

    // expanded ring
    if (expanded && !isRoot) {
      ctx.beginPath(); ctx.arc(node.x, node.y, radius + 2.5, 0, 2 * Math.PI)
      ctx.strokeStyle = baseColor + "88"; ctx.lineWidth = 1; ctx.stroke()
    }

    // hover rings
    if (isHovered) {
      ctx.beginPath(); ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI)
      ctx.strokeStyle = accent + "e6"; ctx.lineWidth = 2; ctx.stroke()
    } else if (isHovNbr) {
      ctx.beginPath(); ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI)
      ctx.strokeStyle = accent + "72"; ctx.lineWidth = 1.5; ctx.stroke()
    }

    // core
    ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = baseColor; ctx.fill()

    // pin dot
    if (node.fx != null) {
      ctx.beginPath(); ctx.arc(node.x, node.y - radius, 2.5, 0, 2 * Math.PI)
      ctx.fillStyle = theme.pinDot; ctx.fill()
    }

    // label — skip entirely for faded nodes
    if (!isFaded && (globalScale > 0.6 || isHovered || isHovNbr)) {
      const fontSize = (isHovered || isHovNbr) && globalScale <= 0.6 ? 11 : Math.max(10, 13 / globalScale)
      const label    = node.title?.length > 22 ? node.title.slice(0, 20) + "…" : (node.title ?? node.id)
      ctx.font      = `${isRoot || isHovered ? 600 : 400} ${fontSize}px 'DM Sans', sans-serif`
      ctx.fillStyle = isHovered ? accent : isHovNbr ? (accent + "d9") : isRoot ? accent : theme.nodeLabel
      ctx.textAlign = "center"
      ctx.fillText(label, node.x, node.y + radius + fontSize * 0.9)
    }

    ctx.globalAlpha = 1
  }, [loadedIds, visibleGraph.links, filterHighlightIds, colorMode, sizeMode,
      nodeDegrees, maxDeg, nodeAvgSim, maxAvgSim, pinnedIds,
      hoveredNode, hoveredNeighborIds, accent, theme, getNodeRadius])

  // ── Render ──────────────────────────────────────────────────────────────────
  const isEmpty = graphData.nodes.length === 0
  const s = makeStyles(theme)

  return (
    <div style={{ ...s.shell, backgroundColor: theme.bg }} onMouseMove={e => { mousePosRef.current = { x: e.clientX, y: e.clientY } }}>
      <style>{`
        @keyframes tabPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.5)} }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{ ...s.header, background: theme.headerBg }}>
        <h1 style={{ ...s.logo, color: theme.text }}>CINE<span style={{ color: accent }}>GRAPH</span></h1>

        <div style={s.navBtns}>
          <button style={{ ...s.navBtn, color: history.length ? theme.text : theme.textFaint, borderColor: theme.border }} onClick={handleGoBack}  disabled={!history.length} title="Go back">←</button>
          <button style={{ ...s.navBtn, color: future.length  ? theme.text : theme.textFaint, borderColor: theme.border }} onClick={handleGoForward} disabled={!future.length}  title="Go forward">→</button>
        </div>

        <div style={s.searchWrap}>
          <input ref={searchInputRef}
            style={{ ...s.input, background: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
            value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={indexLoading ? "Loading index…" : "Search a movie to begin…"}
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <ul style={{ ...s.dropdown, background: theme.dropdownBg, borderColor: theme.border }}>
              {suggestions.map((m, i) => (
                <li key={m.id}
                  style={{ ...s.suggestion, color: theme.text, background: i === searchIdx ? theme.accentBg : "transparent" }}
                  onClick={() => handleSelectMovie(m)}
                  onMouseEnter={() => setSearchIdx(i)}
                >
                  <span>{m.title}</span>
                  {m.genres?.length > 0 && <span style={{ ...s.suggestionGenre, color: theme.textMuted }}>{m.genres[0]}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {!isEmpty && (
          <>
            <button style={{ ...s.iconLabelBtn, color: theme.textMuted, borderColor: theme.border }} onClick={handleExpandAll} title="Expand all">
              <span style={s.iconLabelBtnIcon}>⧉</span>
              <span>Expand all</span>
            </button>
            <button style={{ ...s.iconLabelBtn, color: theme.textMuted, borderColor: theme.border }} onClick={handleReset} title="Reset graph">
              <span style={s.iconLabelBtnIcon}>↺</span>
              <span>Reset</span>
            </button>
            <button style={{ ...s.iconLabelBtn, color: theme.textMuted, borderColor: theme.border }} onClick={() => fgRef.current?.zoomToFit(400, 20)} title="Recenter">
              <span style={s.iconLabelBtnIcon}>◎</span>
              <span>Recenter</span>
            </button>
            <button style={{ ...s.iconLabelBtn, color: lassoMode ? accent : theme.textMuted, borderColor: lassoMode ? accent : theme.border }} onClick={() => setLassoMode(m => !m)} title="Lasso select">
              <span style={s.iconLabelBtnIcon}>✥</span>
              <span>Lasso</span>
            </button>
          </>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <a href="https://github.com/js2264/cinegraph" target="_blank" rel="noopener noreferrer"
            style={{ ...s.iconOnlyBtn, color: theme.textMuted, borderColor: theme.border }}
            title="View on GitHub"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          </a>
          <button style={{ ...s.iconOnlyBtn, color: theme.text, borderColor: theme.border }} onClick={() => setDarkMode(d => !d)} title="Toggle theme">{darkMode ? "☀" : "☾"}</button>
        </div>
      </header>

      {/* ── Filters overlay ──────────────────────────────────────── */}
      {!isEmpty && (
        <div style={{ ...s.filtersOverlay, left: statsVisible ? 268 : 28 }}>
          <div style={{ ...s.statusRow, color: theme.textMuted }}>
            <span style={s.statusDot} />
            {graphData.nodes.length} movies &nbsp;·&nbsp; {graphData.links.length} connections
            {loading && <span style={{ marginLeft: 12, opacity: 0.5 }}>loading…</span>}
          </div>

          {allGenres.length > 0 && (
            <div style={s.pillRow}>
              <span style={{ ...s.pillRowLabel, color: theme.textFaint }}>genre</span>
              {allGenres.map(genre => {
                const active = activeGenres.has(genre)
                return <button key={genre}
                  style={{ ...s.filterPill, background: active ? genreColor([genre]) : theme.pill, borderColor: active ? genreColor([genre]) : theme.pillBorder, color: active ? "#fff" : theme.pillText }}
                  onClick={() => toggleGenre(genre)}>{genre}</button>
              })}
              {activeGenres.size > 0 && <button style={{ ...s.pillClear, color: theme.textFaint }} onClick={() => setActiveGenres(new Set())}>✕</button>}
            </div>
          )}

          {allDecades.length > 0 && (
            <div style={s.pillRow}>
              <span style={{ ...s.pillRowLabel, color: theme.textFaint }}>decade</span>
              {allDecades.map(decade => {
                const active = activeDecade === decade
                return <button key={decade}
                  style={{ ...s.filterPill, background: active ? yearColor(decade + 5) : theme.pill, borderColor: active ? yearColor(decade + 5) : theme.pillBorder, color: active ? "#fff" : theme.pillText }}
                  onClick={() => setActiveDecade(active ? null : decade)}>{decade}s</button>
              })}
              {activeDecade !== null && <button style={{ ...s.pillClear, color: theme.textFaint }} onClick={() => setActiveDecade(null)}>✕</button>}
            </div>
          )}

          {graphData.nodes.length > 0 && (
            <>
              <div style={{ ...s.pillRow, alignItems: "center" }}>
                <span style={{ ...s.pillRowLabel, color: theme.textFaint }}>rating</span>
                <span style={{ ...s.rangeValue, color: theme.textMuted }}>{voteAvgRange[0].toFixed(1)} – {voteAvgRange[1].toFixed(1)}</span>
                <div style={{ width: 120, margin: "0 6px" }}>
                  <Slider
                    range
                    min={voteAvgBounds[0]}
                    max={voteAvgBounds[1]}
                    step={0.1}
                    value={voteAvgRange}
                    onChange={setVoteAvgRange}
                    allowCross={false}
                    styles={{
                      track: { backgroundColor: accent },
                      handle: { borderColor: accent, backgroundColor: theme.surface },
                    }}
                  />
                </div>
                {(voteAvgRange[0] > voteAvgBounds[0] || voteAvgRange[1] < voteAvgBounds[1]) && (
                  <button style={{ ...s.pillClear, color: theme.textFaint }} onClick={() => setVoteAvgRange([voteAvgBounds[0], voteAvgBounds[1]])}>✕</button>
                )}
              </div>

              <div style={{ ...s.pillRow, alignItems: "center" }}>
                <span style={{ ...s.pillRowLabel, color: theme.textFaint }}>runtime</span>
                <span style={{ ...s.rangeValue, color: theme.textMuted }}>{runtimeRange[0]}m – {runtimeRange[1]}m</span>
                <div style={{ width: 120, margin: "0 6px" }}>
                  <Slider
                    range
                    min={runtimeBounds[0]}
                    max={runtimeBounds[1]}
                    step={5}
                    value={runtimeRange}
                    onChange={setRuntimeRange}
                    allowCross={false}
                    styles={{
                      track: { backgroundColor: accent },
                      handle: { borderColor: accent, backgroundColor: theme.surface },
                    }}
                  />
                </div>
                {(runtimeRange[0] > runtimeBounds[0] || runtimeRange[1] < runtimeBounds[1]) && (
                  <button style={{ ...s.pillClear, color: theme.textFaint }} onClick={() => setRuntimeRange([runtimeBounds[0], runtimeBounds[1]])}>✕</button>
                )}
              </div>
            </>
          )}

          <div style={s.pillRow}>
            <span style={{ ...s.pillRowLabel, color: theme.textFaint }}>color by</span>
            {COLOR_MODES.map(mode => {
              const active = colorMode === mode.id
              return <button key={mode.id}
                style={{ ...s.filterPill, background: active ? theme.accentBg : theme.pill, borderColor: active ? theme.accentBorder : theme.pillBorder, color: active ? accent : theme.pillText }}
                onClick={() => setColorMode(mode.id)}>{mode.label}</button>
            })}
          </div>

          <div style={s.pillRow}>
            <span style={{ ...s.pillRowLabel, color: theme.textFaint }}>size by</span>
            {[{id:"default",label:"Default"},{id:"degree",label:"Degree"},{id:"similarity",label:"Similarity"}].map(mode => {
              const active = sizeMode === mode.id
              return <button key={mode.id}
                style={{ ...s.filterPill, background: active ? theme.accentBg : theme.pill, borderColor: active ? theme.accentBorder : theme.pillBorder, color: active ? accent : theme.pillText }}
                onClick={() => setSizeMode(mode.id)}>{mode.label}</button>
            })}
          </div>

          <div style={{ ...s.pillRow, alignItems: "center" }}>
            <span style={{ ...s.pillRowLabel, color: theme.textFaint }}>neighbors</span>
            <div style={{ width: 120, margin: "0 6px" }}>
              <Slider
                min={1}
                max={20}
                step={1}
                value={maxNeighbors}
                onChange={setMaxNeighbors}
                styles={{
                  track: { backgroundColor: accent },
                  handle: { borderColor: accent, backgroundColor: theme.surface },
                }}
              />
            </div>
            <span style={{ ...s.rangeValue, color: theme.textMuted }}>{maxNeighbors}</span>
            <span style={{ ...s.pillRowLabel, color: theme.textFaint, marginLeft: 12 }}>force</span>
            <div style={{ width: 120, margin: "0 6px" }}>
              <Slider
                min={-800}
                max={-100}
                step={50}
                value={chargeStrength}
                onChange={setChargeStrength}
                styles={{
                  track: { backgroundColor: accent },
                  handle: { borderColor: accent, backgroundColor: theme.surface },
                }}
              />
            </div>
          </div>

          {pinnedIds.size > 0 && (
            <div style={s.pillRow}>
              <button style={{ ...s.filterPill, background: theme.accentBg, color: accent, borderColor: theme.accentBorder }}
                onClick={() => setPinnedIds(new Set())}>Clear focus ({pinnedIds.size}) ✕</button>
            </div>
          )}
        </div>
      )}

      {/* ── Tooltip ──────────────────────────────────────────────── */}
      {hoveredNode && (
        <div style={{ ...s.tooltip, background: theme.tooltipBg, borderColor: theme.border, left: Math.min(tooltipPos.x + 16, window.innerWidth - 260), top: Math.max(10, tooltipPos.y - 120) }}>
          <span style={{ ...s.tooltipTitle, color: theme.text }}>{hoveredNode.title}</span>
          <span style={{ ...s.tooltipMeta, color: theme.textMuted }}>
            {(hoveredNode.year || yearCache.current.get(hoveredNode.id)) ? (hoveredNode.year || yearCache.current.get(hoveredNode.id)) : ""}
            {hoveredNode.vote_avg != null && ` ★ ${hoveredNode.vote_avg.toFixed(1)}`}
            {hoveredNode.runtime != null && ` · ${hoveredNode.runtime} min`}
          </span>
          {hoveredNode.snn != null && <span style={{ ...s.tooltipSnn, color: accent }}>Similarity: {hoveredNode.snn}</span>}
          {!loadedIds.has(hoveredNode.id) && <span style={{ ...s.tooltipHint, color: theme.textMuted }}>click to expand</span>}
        </div>
      )}

      {/* ── Force graph ──────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: statsVisible ? 240 : 0, right: 0, overflow: "hidden" }}>
        <ForceGraph2D
          ref={fgRef}
          graphData={visibleGraph}
          width={graphWidth}
          backgroundColor={theme.bg}
          nodeLabel={() => ""}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color
            ctx.beginPath(); ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI); ctx.fill()
          }}
          onNodeDragStart={node => {
            const el = document.querySelector(".force-graph-container canvas")
            if (el) el.style.cursor = "grabbing"
          }}
          linkColor={l => {
            const s = typeof l.source === "object" ? l.source.id : l.source
            const t = typeof l.target === "object" ? l.target.id : l.target
            if (hoveredNode && (s === hoveredNode.id || t === hoveredNode.id)) return theme.linkHover
            // Filter highlight — fade edges connected to faded nodes
            if (filterHighlightIds !== null) {
              const srcVisible = filterHighlightIds.has(s)
              const tgtVisible = filterHighlightIds.has(t)
              if (!srcVisible || !tgtVisible) {
                return darkMode ? "rgba(232,228,222,0.03)" : "rgba(45,42,38,0.03)"
              }
            }
            if (pinnedIds.size > 0) {
              const inc = pinnedIds.has(s) || pinnedIds.has(t)
              return inc ? (darkMode ? "rgba(232,228,222,0.22)" : "rgba(45,42,38,0.22)") : (darkMode ? "rgba(232,228,222,0.04)" : "rgba(45,42,38,0.04)")
            }
            return theme.linkColor
          }}
          linkWidth={l => 0.6 + ((l.strength ?? 10) / 50) * 1.5}
          linkDirectionalParticles={l => {
            if (!hoveredNode) return 0
            const s = typeof l.source === "object" ? l.source.id : l.source
            const t = typeof l.target === "object" ? l.target.id : l.target
            return (s === hoveredNode.id || t === hoveredNode.id) ? 1 : 0
          }}
          linkDirectionalParticleSpeed={0.005}
          onNodeClick={node => handleNodeClick(node)}
          onNodeDragEnd={node => {
            node.fx = node.x; node.fy = node.y
            setPinnedIds(prev => new Set([...prev, node.id]))
          }}
          onNodeRightClick={(node, event) => {
            event.preventDefault()
            setContextMenu({ x: event.clientX, y: event.clientY, node })
          }}
          onBackgroundClick={() => {
            const now = Date.now()
            if (now - lastBgClickRef.current < 350) { setPinnedIds(new Set()); setContextMenu(null) }
            lastBgClickRef.current = now
          }}
          onNodeHover={node => {
            setHoveredNode(node ?? null)
            if (node) setTooltipPos({ x: mousePosRef.current.x, y: mousePosRef.current.y })
          }}
          onRenderFramePre={drawParticles}
          warmupTicks={60}
          cooldownTicks={200}
          d3AlphaDecay={0.015}
          d3VelocityDecay={0.25}
        />

        {/* ── Lasso overlay ────────────────────────────────────────── */}
        {lassoMode && (
          <div
            style={{ position: "absolute", inset: 0, zIndex: 15, cursor: "crosshair" }}
            onPointerDown={handleLassoDown}
            onPointerMove={handleLassoMove}
            onPointerUp={handleLassoUp}
          >
            {lassoActive && lassoPoints.length > 1 && (
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                <polygon points={lassoPoints.map(p => `${p.x},${p.y}`).join(" ")} fill={`${accent}18`} stroke={accent} strokeWidth={1} strokeDasharray="4 3" />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* ── Offscreen directional arrows ─────────────────────────── */}
      {graphData.nodes.length <= 50 && offscreenArrows.map(({ id, angle, ex, ey }) => (
        <div key={id} style={{
          position: "absolute",
          left: (statsVisible ? 240 : 0) + ex,
          top: ey,
          width: 20, height: 20,
          transform: `translate(-50%,-50%) rotate(${(angle * 180 / Math.PI).toFixed(1)}deg)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: theme.tooltipBg, border: `1px solid ${theme.border}`,
          borderRadius: "50%", fontSize: 9, pointerEvents: "none", zIndex: 8,
          backdropFilter: "blur(4px)", color: theme.textMuted,
        }}>▶</div>
      ))}

      {/* ── Empty state ──────────────────────────────────────────── */}
      {isEmpty && (
        <div style={s.emptyState}>
          <div style={{ ...s.emptyIcon, color: theme.emptyIcon }}>◎</div>
          <p style={{ ...s.emptyText, color: theme.emptyText }}>Search for a film above.<br />Click any node to expand its recommendation network.</p>
          <button
            style={{ ...s.surpriseBtn, background: theme.accentBg, color: theme.accent, borderColor: theme.accent }}
            onClick={handleSurpriseMe}
          >
            Surprise me!
          </button>
          <p style={{ ...s.helpHint, color: theme.textFaint }}>Drag nodes · Right-click for options · Scroll to zoom</p>
        </div>
      )}

      {/* ── In-graph hint ─────────────────────────────────────────── */}
      {!isEmpty && (
        <div style={{ ...s.graphHint, color: theme.textFaint }}>
          {lassoMode ? "Drag to draw selection shape · Release to prune" : "Drag nodes · Right-click for options · Scroll to zoom · Double-click background to clear focus"}
        </div>
      )}

      {/* ── About + Help buttons (bottom-right) ─────────────────── */}
      <div style={{ position: "absolute", right: (panelOpen ? 288 : 8), bottom: 8, zIndex: 25, display: "flex", gap: 6 }}>
        <button
          style={{ ...s.cornerBtn, position: "relative", right: "auto", bottom: "auto", background: theme.tabBg, borderColor: theme.border, color: theme.textMuted }}
          onClick={() => setAboutOpen(true)}
          title="About"
        >ℹ</button>
        <button
          style={{ ...s.cornerBtn, position: "relative", right: "auto", bottom: "auto", background: theme.tabBg, borderColor: theme.border, color: theme.textMuted }}
          onClick={() => setHelpOpen(true)}
          title="Help"
        >?</button>
      </div>

      {/* ── Help modal ───────────────────────────────────────────── */}
      {/* ── Command palette (Ctrl+K) ──────────────────────────────────── */}
      {cmdOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 100, background: "rgba(0,0,0,0.25)" }}
          onClick={() => setCmdOpen(false)}
        >
          <div
            style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, width: 460, maxWidth: "90vw", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: "9px 14px", borderBottom: `1px solid ${theme.border}`, fontSize: 11, color: theme.textMuted, letterSpacing: "0.08em", fontWeight: 600 }}>COMMANDS</div>
            {[
              { label: "Search a movie",       kbd: "/",  action: () => { searchInputRef.current?.focus(); setCmdOpen(false) } },
              { label: "Surprise me!",         kbd: "",   action: () => { handleSurpriseMe(); setCmdOpen(false) } },
              { label: "Expand all",           kbd: "",   action: () => { expandAllRef.current?.(); setCmdOpen(false) } },
              { label: "Show / hide stats",    kbd: "D",  action: () => { setStatsVisible(v => !v); setCmdOpen(false) } },
              { label: "Show / hide details",  kbd: "M",  action: () => { if (selectedNode) setPanelUserClosed(v => !v); setCmdOpen(false) } },
              { label: "Toggle dark mode",     kbd: "",   action: () => { setDarkMode(v => !v); setCmdOpen(false) } },
              { label: "Help",                 kbd: "?",  action: () => { setHelpOpen(true); setCmdOpen(false) } },
              { label: "About",                kbd: "",   action: () => { setAboutOpen(true); setCmdOpen(false) } },
            ].map(({ label, kbd, action }) => (
              <button
                key={label} onClick={action}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "10px 16px", background: "transparent", border: "none", borderBottom: `1px solid ${theme.border}`, color: theme.text, fontSize: 13, cursor: "pointer", textAlign: "left", boxSizing: "border-box" }}
                onMouseEnter={e => e.currentTarget.style.background = theme.accentBg}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span>{label}</span>
                {kbd && <kbd style={{ fontSize: 10, background: theme.pill, border: `1px solid ${theme.border}`, borderRadius: 4, padding: "2px 6px", color: theme.textMuted, fontFamily: "monospace" }}>{kbd}</kbd>}
              </button>
            ))}
          </div>
        </div>
      )}

      {helpOpen && (
        <Modal theme={theme} onClose={() => setHelpOpen(false)} title="How to use Cinegraph">
          <div style={{ display: "flex", flexDirection: "column", gap: 14, color: theme.text, fontSize: 13, lineHeight: 1.6 }}>
            <section>
              <h4 style={{ margin: "0 0 6px", color: theme.accent, fontSize: 13 }}>Exploring the graph</h4>
              <p style={{ margin: 0 }}>Search for a movie to start. Click any node to expand its network of similar films. Double-click the background to clear focus.</p>
            </section>
            <section>
              <h4 style={{ margin: "0 0 6px", color: theme.accent, fontSize: 13 }}>Navigation</h4>
              <p style={{ margin: 0 }}>Click and drag to pan. Scroll or pinch to zoom. Drag a node to reposition it.</p>
            </section>
            <section>
              <h4 style={{ margin: "0 0 6px", color: theme.accent, fontSize: 13 }}>Controls</h4>
              <p style={{ margin: 0 }}>Right-click a node for options (pin, collapse, remove). Use the Lasso tool to select multiple nodes. The back/forward arrows undo or redo expansions.</p>
            </section>
            <section>
              <h4 style={{ margin: "0 0 6px", color: theme.accent, fontSize: 13 }}>Filters</h4>
              <p style={{ margin: 0 }}>Genre and decade pills highlight matching nodes. Use the force slider to adjust graph spacing.</p>
            </section>
            <section>
              <h4 style={{ margin: "0 0 6px", color: theme.accent, fontSize: 13 }}>Keyboard shortcuts</h4>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}><tbody>
                {[["/", "Focus search"], ["D", "Toggle stats panel"], ["M", "Toggle movie details"], ["Ctrl+K", "Open command palette"], ["Esc", "Close / dismiss"]].map(([key, desc]) => (
                  <tr key={key}>
                    <td style={{ padding: "3px 12px 3px 0", whiteSpace: "nowrap" }}><kbd style={{ fontSize: 11, background: theme.pill, border: `1px solid ${theme.border}`, borderRadius: 4, padding: "2px 6px", color: theme.textMuted, fontFamily: "monospace" }}>{key}</kbd></td>
                    <td style={{ padding: "3px 0", color: theme.textMuted }}>{desc}</td>
                  </tr>
                ))}
              </tbody></table>
            </section>
          </div>
        </Modal>
      )}

      {/* ── About modal ──────────────────────────────────────────── */}
      {aboutOpen && (
        <Modal theme={theme} onClose={() => setAboutOpen(false)} title="About Cinegraph">
          <div style={{ display: "flex", flexDirection: "column", gap: 14, color: theme.text, fontSize: 13, lineHeight: 1.6 }}>
            <p style={{ margin: 0 }}>Cinegraph is an interactive movie discovery app built on a Shared Nearest Neighbour graph computed from user ratings.</p>
            <p style={{ margin: 0 }}>Developed by <a href="https://github.com/js2264" target="_blank" rel="noopener noreferrer" style={{ color: theme.accent }}>js2264</a>.</p>
            <p style={{ margin: 0 }}>
              <a href="https://github.com/js2264/cinegraph" target="_blank" rel="noopener noreferrer" style={{ color: theme.accent }}>View source on GitHub ↗</a>
            </p>
          </div>
        </Modal>
      )}

      {/* ── Context menu ─────────────────────────────────────────── */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y} node={contextMenu.node}
          darkMode={darkMode} theme={theme}
          onClose={() => setContextMenu(null)}
          onPin={() => {
            const n = contextMenu.node
            const id = String(n.id)
            if (n.fx != null) { n.fx = undefined; n.fy = undefined; setPinnedIds(prev => { const next = new Set(prev); next.delete(id); return next }); fgRef.current?.d3ReheatSimulation() }
            else              { n.fx = n.x; n.fy = n.y; setPinnedIds(prev => new Set([...prev, id])) }
          }}
          onCollapse={() => collapseNode(String(contextMenu.node.id))}
          onRemove={() => {
            const id = String(contextMenu.node.id)
            setGraphData(prev => ({
              nodes: prev.nodes.filter(n => String(n.id) !== id),
              links: prev.links.filter(l => { const s = typeof l.source==="object"?l.source.id:l.source; const t = typeof l.target==="object"?l.target.id:l.target; return String(s) !== id && String(t) !== id }),
            }))
            setPinnedIds(prev => { const next = new Set(prev); next.delete(id); return next })
            setLoadedIds(prev => { const next = new Set(prev); next.delete(id); return next })
          }}
          onHighlight={() => setPinnedIds(prev => new Set([...prev, String(contextMenu.node.id)]))}
          onShowDetails={() => {
            const n = { ...contextMenu.node, tmdb_id: contextMenu.node.tmdb_id ?? String(contextMenu.node.id) }
            setSelectedNode(n)
            setPanelUserClosed(false)
          }}
        />
      )}

      {/* ── Stats panel ──────────────────────────────────────────── */}
      {statsVisible && <StatsPanel graphData={visibleGraph} darkMode={darkMode} theme={theme} onClose={() => setStatsVisible(false)} filterHighlightIds={filterHighlightIds} />}
      {!isEmpty && (
        <button
          style={{ ...s.sideTabLeft, left: statsVisible ? 240 : 0, background: theme.tabBg, borderColor: theme.border, color: accent }}
          onClick={() => setStatsVisible(v => !v)}
          title={statsVisible ? "Hide stats" : "Show stats"}
        >{statsVisible ? "◄" : "►"}</button>
      )}

      {/* ── Movie panel ───────────────────────────────────────────── */}
      {panelOpen && <MoviePanel key={selectedNode?.id} node={selectedNode} loadingDetails={detailLoading} darkMode={darkMode} theme={theme} onClose={() => setPanelUserClosed(true)} onMoreDetails={() => setMoreDetailsOpen(true)} />}

      {/* ── More details modal ───────────────────────────────────── */}
      {moreDetailsOpen && selectedNode && (
        <Modal theme={theme} onClose={() => setMoreDetailsOpen(false)} title={selectedNode.title}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, color: theme.text, fontSize: 13, lineHeight: 1.6 }}>
            {selectedNode.plot && (
              <section>
                <h4 style={{ margin: "0 0 6px", color: theme.accent, fontSize: 13 }}>Plot</h4>
                <p style={{ margin: 0 }}>{selectedNode.plot}</p>
              </section>
            )}
            {selectedNode.director && (
              <section>
                <h4 style={{ margin: "0 0 6px", color: theme.accent, fontSize: 13 }}>Director</h4>
                <p style={{ margin: 0 }}>{selectedNode.director}</p>
              </section>
            )}
            {selectedNode.writer && (
              <section>
                <h4 style={{ margin: "0 0 6px", color: theme.accent, fontSize: 13 }}>Writer</h4>
                <p style={{ margin: 0 }}>{selectedNode.writer}</p>
              </section>
            )}
            {selectedNode.actors && (
              <section>
                <h4 style={{ margin: "0 0 6px", color: theme.accent, fontSize: 13 }}>Cast</h4>
                <p style={{ margin: 0 }}>{selectedNode.actors}</p>
              </section>
            )}
            {selectedNode.language && (
              <section>
                <h4 style={{ margin: "0 0 6px", color: theme.accent, fontSize: 13 }}>Language</h4>
                <p style={{ margin: 0 }}>{selectedNode.language}</p>
              </section>
            )}
            {selectedNode.country && (
              <section>
                <h4 style={{ margin: "0 0 6px", color: theme.accent, fontSize: 13 }}>Country</h4>
                <p style={{ margin: 0 }}>{selectedNode.country}</p>
              </section>
            )}
            {selectedNode.awards && (
              <section>
                <h4 style={{ margin: "0 0 6px", color: theme.accent, fontSize: 13 }}>Awards</h4>
                <p style={{ margin: 0 }}>{selectedNode.awards}</p>
              </section>
            )}
            {(selectedNode.imdb_id || selectedNode.tmdb_id) && (
              <section style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {selectedNode.tmdb_id && (
                  <a href={`https://www.themoviedb.org/movie/${selectedNode.tmdb_id}`} target="_blank" rel="noopener noreferrer" style={{ color: theme.accent }}>View on TMDB ↗</a>
                )}
                {selectedNode.imdb_id && (
                  <a href={`https://www.imdb.com/title/${selectedNode.imdb_id}`} target="_blank" rel="noopener noreferrer" style={{ color: theme.accent }}>View on IMDb ↗</a>
                )}
              </section>
            )}
          </div>
        </Modal>
      )}
      {selectedNode && (
        <button
          style={{ ...s.sideTabRight, right: panelOpen ? 280 : 0, background: theme.tabBg, borderColor: theme.border, color: accent,
            animation: panelHasNew ? "tabPulse 1.2s ease-in-out 3" : "none",
            filter: panelHasNew ? `drop-shadow(0 0 6px ${accent})` : "none",
          }}
          onClick={() => { if (panelOpen) setPanelUserClosed(true); else setPanelUserClosed(false); }}
          title={panelOpen ? "Hide details" : "Show details"}
        >{panelOpen ? "►" : "◄"}</button>
      )}
    </div>
  )
}

// ── Modal component ───────────────────────────────────────────────────────────
function Modal({ theme, onClose, title, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "24px 28px", maxWidth: 460, width: "90vw", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 16px 48px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 18, color: theme.text }}>{title}</h3>
          <button style={{ background: "transparent", border: "none", fontSize: 20, color: theme.textMuted, cursor: "pointer", lineHeight: 1, padding: "0 4px" }} onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(theme) {
  return {
    shell:          { width: "100vw", height: "100vh", position: "relative", overflow: "hidden" },
    header:         { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 16, padding: "16px 24px" },
    logo:           { fontFamily: "'Playfair Display', serif", fontSize: 20, letterSpacing: "0.3em", fontWeight: 700, flexShrink: 0, userSelect: "none" },
    navBtns:        { display: "flex", gap: 4, flexShrink: 0 },
    navBtn:         { background: "transparent", border: "1px solid", borderRadius: 5, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, padding: 0, fontFamily: "'DM Sans', sans-serif" },
    searchWrap:     { position: "relative", flex: 1, maxWidth: 440, zIndex: 1000 },
    input:          { width: "100%", border: "1px solid", borderRadius: 6, padding: "8px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", transition: "border-color 0.2s", boxSizing: "border-box" },
    dropdown:       { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, border: "1px solid", borderRadius: 6, listStyle: "none", padding: "4px 0", margin: 0, zIndex: 1000, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" },
    suggestion:     { padding: "9px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" },
    suggestionGenre:{ fontSize: 11, fontStyle: "italic" },
    sliderWrap:     { display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 },
    sliderLabel:    { fontSize: 10, fontFamily: "monospace", textAlign: "center" },
    slider:         { width: 90, cursor: "pointer" },
    rangeValue:     { fontSize: 10, fontFamily: "monospace", minWidth: 28, textAlign: "center" },
    resetBtn:       { flexShrink: 0, background: "transparent", border: "1px solid", borderRadius: 5, fontSize: 12, fontFamily: "'DM Sans', sans-serif", padding: "6px 12px", cursor: "pointer" },
    iconLabelBtn:   { flexShrink: 0, background: "transparent", border: "1px solid", borderRadius: 5, fontSize: 12, fontFamily: "'DM Sans', sans-serif", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
    iconLabelBtnIcon:{ fontSize: 13, lineHeight: 1 },
    iconOnlyBtn:    { flexShrink: 0, background: "transparent", border: "1px solid", borderRadius: 5, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, padding: 0, textDecoration: "none" },
    themeBtn:       { flexShrink: 0, background: "transparent", border: "1px solid", borderRadius: 5, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, padding: 0 },
    filtersOverlay: { position: "absolute", top: 68, left: 28, right: 28, zIndex: 10, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" },
    statusRow:      { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "monospace", pointerEvents: "none" },
    statusDot:      { width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 },
    pillRow:        { display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", pointerEvents: "auto" },
    pillRowLabel:   { fontSize: 10, fontFamily: "monospace", marginRight: 2, flexShrink: 0 },
    filterPill:     { border: "1px solid", borderRadius: 20, padding: "3px 11px", fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", transition: "all 0.15s" },
    pillClear:      { background: "transparent", border: "none", fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", padding: "3px 6px" },
    tooltip:        { position: "fixed", zIndex: 30, border: "1px solid", borderRadius: 8, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, pointerEvents: "none", backdropFilter: "blur(8px)", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" },
    tooltipTitle:   { fontSize: 15, fontFamily: "'Playfair Display', serif" },
    tooltipMeta:    { fontSize: 11, fontFamily: "monospace" },
    tooltipSnn:     { fontSize: 12, fontFamily: "monospace" },
    tooltipHint:    { fontSize: 11, fontFamily: "'DM Sans', sans-serif", marginTop: 2 },
    emptyState:     { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "auto", zIndex: 5 },
    emptyIcon:      { fontSize: 48, marginBottom: 16 },
    emptyText:      { fontSize: 14, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.7, margin: "0 0 8px" },
    helpHint:       { fontSize: 12, fontFamily: "'DM Sans', sans-serif", opacity: 0.8 },
    graphHint:      { position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", fontSize: 11, fontFamily: "'DM Sans', sans-serif", pointerEvents: "none", whiteSpace: "nowrap", zIndex: 5 },
    surpriseBtn:    { marginTop: 12, padding: "10px 18px", borderRadius: 20, border: "1px solid", fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", background: "transparent", textAlign: "center", transition: "all 0.15s" },
    cornerBtn:      { position: "absolute", zIndex: 25, width: 32, height: 32, borderRadius: "50%", border: "1px solid", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", transition: "all 0.15s" },
    sideTabLeft:    { position: "absolute", top: "50%", marginTop: "-17px", left: 0, zIndex: 25, border: "1px solid", borderLeft: "none", borderRadius: "0 6px 6px 0", padding: "10px 6px", cursor: "pointer", fontSize: 12, boxShadow: "2px 0 8px rgba(0,0,0,0.06)" },
    sideTabRight:   { position: "absolute", top: "50%", marginTop: "-17px", right: 0, zIndex: 25, border: "1px solid", borderRight: "none", borderRadius: "6px 0 0 6px", padding: "10px 6px", cursor: "pointer", fontSize: 12, boxShadow: "-2px 0 8px rgba(0,0,0,0.06)", transformOrigin: "center" },
  }
}
