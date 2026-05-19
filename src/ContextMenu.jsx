import { useEffect, useRef } from "react"

export default function ContextMenu({ x, y, node, theme, onClose, onPin, onRemove, onCollapse, onHighlight, onShowDetails }) {
  const menuRef = useRef()

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    const handleKey = (e) => { if (e.key === "Escape") onClose() }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [onClose])

  const isPinned = node.fx != null
  const t = theme ?? { surface: "#fff", border: "rgba(0,0,0,0.08)", text: "#2d2a26", textMuted: "rgba(45,42,38,0.5)" }

  const items = [
    { label: isPinned ? "Unpin" : "Pin",       action: onPin },
    { label: "Collapse node",                   action: onCollapse },
    { label: "Remove",                          action: onRemove },
    { label: "Focus neighbors",                 action: onHighlight },
    { label: "Show details",                    action: onShowDetails },
  ]

  return (
    <div
      ref={menuRef}
      style={{ position: "fixed", left: x, top: y, zIndex: 200,
        background: t.surface, border: `1px solid ${t.border}`,
        borderRadius: 8, padding: "6px 0",
        boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
        minWidth: 170, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}
    >
      {items.map(item => (
        <button
          key={item.label}
          onClick={() => { item.action?.(); onClose() }}
          style={{ display: "block", width: "100%", textAlign: "left",
            background: "transparent", border: "none",
            padding: "9px 16px", cursor: "pointer",
            color: t.text, fontSize: 13,
            fontFamily: "'DM Sans', sans-serif", transition: "background 0.1s" }}
          onMouseEnter={e => (e.currentTarget.style.background = t.accentBg ?? "rgba(0,0,0,0.05)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >{item.label}</button>
      ))}
    </div>
  )
}
