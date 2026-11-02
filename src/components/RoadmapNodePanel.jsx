import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowRight, Check, ClipboardCheck, RotateCcw, Trophy, X } from 'lucide-react'
import { LEVEL_LABELS } from '../utils/masteryLearning.js'

const MOBILE_QUERY = '(max-width: 820px)'
const VIEWPORT_MARGIN = 12
const ANCHOR_GAP = 14
const PLACEMENTS = ['right', 'left', 'bottom', 'top']

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

function useMediaQuery(query) {
  const subscribe = useCallback(callback => {
    const media = window.matchMedia(query)
    media.addEventListener('change', callback)
    return () => media.removeEventListener('change', callback)
  }, [query])
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

const stateIcon = key => key === 'mastered' ? <Trophy size={14} aria-hidden="true" /> : key === 'review' ? <RotateCcw size={14} aria-hidden="true" /> : key === 'complete' ? <Check size={14} aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />

function panelRect(left, top, width, height) {
  return { left, top, right: left + width, bottom: top + height }
}

function overlaps(a, b, gap = 0) {
  return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap
}

function overlapArea(a, b) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return width > 0 && height > 0 ? width * height : 0
}

function placePanel(panel, anchor) {
  if (!panel || !anchor) return
  const groupRect = anchor.getBoundingClientRect()
  const shape = anchor.querySelector('.map-lesson-node, .map-checkpoint, .map-end')
  const anchorRect = shape ? shape.getBoundingClientRect() : groupRect
  if (!anchorRect.width && !anchorRect.height) return

  const width = panel.offsetWidth
  const height = panel.offsetHeight
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const sidebar = document.querySelector('.sidebar')
  const sidebarRect = sidebar && window.getComputedStyle(sidebar).position === 'fixed' ? sidebar.getBoundingClientRect() : null
  const bounds = {
    left: Math.max(VIEWPORT_MARGIN, sidebarRect?.right ? sidebarRect.right + VIEWPORT_MARGIN : VIEWPORT_MARGIN),
    right: viewportWidth - VIEWPORT_MARGIN,
    top: VIEWPORT_MARGIN,
    bottom: viewportHeight - VIEWPORT_MARGIN,
  }

  const tabsRect = document.querySelector('.roadmap-tabs')?.getBoundingClientRect()
  if (tabsRect?.bottom > bounds.top && tabsRect.top < viewportHeight) bounds.top = Math.max(bounds.top, tabsRect.bottom + 8)

  const progress = document.querySelector('.roadmap-left-column')
  const progressRect = progress?.getBoundingClientRect()
  const progressVisible = Boolean(progressRect?.width && progressRect?.height)
  if (progressVisible && progressRect.left > viewportWidth * .55) bounds.right = Math.min(bounds.right, progressRect.left - ANCHOR_GAP)
  if (bounds.right - bounds.left < width) bounds.right = Math.min(viewportWidth - VIEWPORT_MARGIN, bounds.left + width)

  const centerX = anchorRect.left + anchorRect.width / 2
  const centerY = anchorRect.top + anchorRect.height / 2
  const rawCandidates = {
    right: { left: anchorRect.right + ANCHOR_GAP, top: centerY - height / 2 },
    left: { left: anchorRect.left - width - ANCHOR_GAP, top: centerY - height / 2 },
    bottom: { left: centerX - width / 2, top: anchorRect.bottom + ANCHOR_GAP },
    top: { left: centerX - width / 2, top: anchorRect.top - height - ANCHOR_GAP },
  }

  // Measure shapes and labels separately: the group's bounding box also includes
  // empty space between them, which should not count as covered content.
  const otherNodes = [...document.querySelectorAll('.map-node-group')].flatMap(element => {
    if (element === anchor) return []
    return [...element.querySelectorAll('.map-lesson-node, .map-checkpoint, .map-end, .map-node-title, .map-node-subtitle')]
      .map(item => item.getBoundingClientRect())
      .filter(rect => rect.width && rect.height)
  })
  const nodePenalty = rect => Math.min(900, otherNodes.reduce((sum, other) => sum + overlapArea(rect, other), 0) / 60)

  let best = null
  PLACEMENTS.forEach((name, order) => {
    const candidate = rawCandidates[name]
    const left = clamp(candidate.left, bounds.left, Math.max(bounds.left, bounds.right - width))
    const top = clamp(candidate.top, bounds.top, Math.max(bounds.top, bounds.bottom - height))
    const rect = panelRect(left, top, width, height)
    const fits = candidate.left >= bounds.left - .5 && candidate.left + width <= bounds.right + .5 && candidate.top >= bounds.top - .5 && candidate.top + height <= bounds.bottom + .5
    const overflow = Math.abs(left - candidate.left) + Math.abs(top - candidate.top)
    // Keep the clamp penalty above 900 so any unclamped candidate still wins.
    const score = (fits ? 0 : 1000 + overflow) + (progressVisible && overlaps(rect, progressRect, 8) ? 5000 : 0) + nodePenalty(rect) + order
    if (!best || score < best.score) best = { name, left, top, score }
  })

  panel.style.left = `${Math.round(best.left)}px`
  panel.style.top = `${Math.round(best.top)}px`
  panel.dataset.placement = best.name
  const arrow = best.name === 'left' || best.name === 'right'
    ? clamp(centerY - best.top, 20, height - 20)
    : clamp(centerX - best.left, 20, width - 20)
  panel.style.setProperty('--panel-arrow', `${Math.round(arrow)}px`)
}

export default function RoadmapNodePanel({
  panelRef, visible, selectedNode, nodeRefs, stage, node, nextStage,
  stateKey, stateLabel, levels, mastery, session, finished, questions, done,
  actionLabel, checkpointDone, checkpointQuestions, onAction, onClose, onExited,
}) {
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const titleId = useId()
  const descriptionId = useId()
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef(null)
  const hasBeenVisible = useRef(false)
  const isLesson = node.kind === 'lesson'
  const isMasteryLesson = isLesson && Boolean(levels)
  const isExamStage = stage.id === 'exam'
  const checkpointState = checkpointDone ? 'complete' : 'available'
  const endState = stage.last ? 'complete' : 'current'
  const chipKey = isLesson ? stateKey : node.kind === 'checkpoint' ? checkpointState : endState
  const chipLabel = isLesson ? stateLabel : node.kind === 'checkpoint'
    ? checkpointDone ? 'Đã hoàn thành chặng' : 'Chưa kiểm tra'
    : stage.last ? 'Hoàn tất lộ trình' : 'Chuyển chặng'
  const chipIcon = isLesson ? stateIcon(stateKey) : node.kind === 'checkpoint' ? <ClipboardCheck size={14} aria-hidden="true" /> : stage.last ? <Trophy size={14} aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />
  const actionIcon = actionLabel.startsWith('Ôn') ? <RotateCcw size={17} aria-hidden="true" /> : actionLabel.includes('thi') ? <Trophy size={17} aria-hidden="true" /> : node.kind === 'checkpoint' ? <ClipboardCheck size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />
  const total = mastery?.total ?? questions.length
  const meta = isMasteryLesson
    ? session && !finished ? `Vòng ${session.round} · ${total} thẻ`
      : finished ? `Đã qua bài · ${total} thẻ`
        : `${total} thẻ`
    : null
  const levelLegend = levels
    ? levels.counts.flatMap((count, level) => count > 0 ? [{ key: level, label: LEVEL_LABELS[level], count, color: `var(--mastery-${level})` }] : [])
    : []
  const showLegend = levelLegend.length > 0 && !(isLesson && stateKey === 'mastered')
  const levelLabel = levels
    ? [`Chưa học: ${levels.unseen}`, ...LEVEL_LABELS.map((label, level) => `${label}: ${levels.counts[level]}`)].join(', ')
    : ''

  useLayoutEffect(() => {
    if (!visible || isMobile) return undefined
    const panel = panelRef.current
    const anchor = nodeRefs.current[selectedNode]
    if (!panel || !anchor) return undefined
    let frame = 0
    const update = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        placePanel(panel, nodeRefs.current[selectedNode])
      })
    }
    placePanel(panel, anchor)
    const observer = new ResizeObserver(update)
    observer.observe(panel)
    const layout = document.querySelector('.roadmap-layout')
    if (layout) observer.observe(layout)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [visible, isMobile, selectedNode, panelRef, nodeRefs])

  useLayoutEffect(() => {
    if (!isMobile) return
    const panel = panelRef.current
    if (!panel) return
    panel.style.left = ''
    panel.style.top = ''
    panel.style.removeProperty('--panel-arrow')
    delete panel.dataset.placement
  }, [isMobile, panelRef])

  // Unmount after the close animation, but do not depend on transitionend alone:
  // reduced-motion and background tabs can skip the event entirely.
  useEffect(() => {
    if (visible) {
      hasBeenVisible.current = true
      return undefined
    }
    if (!hasBeenVisible.current) return undefined
    const timer = window.setTimeout(() => {
      hasBeenVisible.current = false
      onExited()
    }, 240)
    return () => window.clearTimeout(timer)
  }, [visible, onExited])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    if (visible) {
      if (!panel.contains(document.activeElement)) {
        const frame = requestAnimationFrame(() => panel.focus({ preventScroll: true }))
        return () => cancelAnimationFrame(frame)
      }
      return undefined
    }
    const anchor = nodeRefs.current[selectedNode]
    if (anchor?.isConnected) anchor.focus({ preventScroll: true })
    return undefined
  }, [visible, selectedNode, panelRef, nodeRefs])

  useEffect(() => {
    if (!isMobile || !visible) return undefined
    const onKeyDown = event => {
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusable = [...panel.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = focusable[0]
      const last = focusable.at(-1)
      const active = document.activeElement
      if (!panel.contains(active)) return
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isMobile, visible, panelRef])

  const startDrag = event => {
    if (!isMobile || event.button !== 0) return
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startTime: performance.now() }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragY(0)
    setDragging(true)
  }
  const moveDrag = event => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setDragY(Math.max(0, event.clientY - drag.startY))
  }
  const finishDrag = event => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const distance = Math.max(0, event.clientY - drag.startY)
    const velocity = distance / Math.max(1, performance.now() - drag.startTime)
    dragRef.current = null
    setDragging(false)
    setDragY(0)
    if (distance > 80 || velocity > .55) onClose()
  }
  const cancelDrag = event => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
    setDragY(0)
  }

  return <aside
    ref={panelRef}
    className={`roadmap-selected-panel roadmap-node-panel${visible ? ' is-visible' : ' is-closing'}${visible && dragging ? ' is-dragging' : ''}`}
    role="dialog"
    aria-modal={isMobile ? 'true' : undefined}
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    tabIndex={-1}
    style={{ '--panel-drag': `${visible ? dragY : 0}px` }}
    onTransitionEnd={event => { if (event.target === event.currentTarget && !visible) onExited() }}
  >
    <div className="roadmap-node-panel__grabber" aria-hidden="true" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag}><span /></div>
    <button type="button" className="roadmap-node-panel__close" aria-label="Đóng chi tiết bài học" onClick={onClose}><X size={17} aria-hidden="true" /></button>
    <div className="roadmap-node-panel__body">
      <p className="roadmap-node-panel__breadcrumb">{stage.title}</p>
      <h2 id={titleId} className="roadmap-node-panel__title">{node.title}</h2>
      <span className={`roadmap-node-chip is-${chipKey}`}>{chipIcon}{chipLabel}</span>

      {isLesson ? isMasteryLesson ? <>
        <div className="stage-level-bar roadmap-node-panel__bar" role="img" aria-label={levelLabel}>
          {levels.counts.map((count, level) => count > 0 && <span key={level} style={{ width: `${levels.total ? count / levels.total * 100 : 0}%`, background: `var(--mastery-${level})` }} />)}
        </div>
        {showLegend && <div className="roadmap-node-panel__levels">
          {levelLegend.map(entry => <span key={entry.key}><i style={{ background: entry.color }} />{entry.label}: {entry.count}</span>)}
        </div>}
        <p className="roadmap-node-panel__meta" id={descriptionId}>{meta}</p>
      </> : <>
        <p className="roadmap-node-panel__description" id={descriptionId}>{isExamStage ? 'Mở đề thi thử tổng hợp.' : `${questions.length} câu · ${done} câu đã làm.`}</p>
      </> : node.kind === 'checkpoint' ? <>
        <p className="roadmap-node-panel__description" id={descriptionId}>Bài kiểm tra gồm {checkpointQuestions.length} câu từ tất cả node nhỏ trong chặng. Bạn có thể bắt đầu ngay; đáp án và điểm chỉ hiện sau khi nộp.</p>
      </> : <>
        <p className="roadmap-node-panel__description" id={descriptionId}>{stage.last ? 'Hoàn tất lộ trình và luyện đề trước ngày thi.' : `Bạn có thể chuyển sang ${nextStage.title} bất cứ lúc nào.`}</p>
      </>}

      {actionLabel && <button type="button" className="btn btn-primary roadmap-node-panel__action" onClick={onAction}>{actionLabel}{actionIcon}</button>}
    </div>
    <span className="roadmap-node-panel__arrow" aria-hidden="true" />
  </aside>
}
