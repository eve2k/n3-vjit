export const POMODORO_DEFAULTS = Object.freeze({ focus: 25, short: 5, long: 15, longEvery: 4 })
export const POMODORO_LIMITS = Object.freeze({ focus: [1, 120], short: [1, 60], long: [1, 90], longEvery: [2, 8] })

export function nextPomodoroStage(kind, completed, longEvery) {
  if (kind === 'focus') {
    const nextCompleted = completed + 1
    return { kind: nextCompleted % longEvery === 0 ? 'long' : 'short', completed: nextCompleted }
  }
  if (kind === 'short' || kind === 'long') return { kind: 'focus', completed }
  throw new TypeError('Unknown Pomodoro stage')
}
