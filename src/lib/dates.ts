export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const fromISODate = (iso: string) => new Date(iso + 'T00:00:00')

export const todayISO = () => toISODate(new Date())

export function addDaysISO(iso: string, n: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export const daysAgoISO = (n: number) => addDaysISO(todayISO(), -n)

/** Monday of the week containing `iso`. */
export function weekStartISO(iso: string): string {
  const offset = (fromISODate(iso).getDay() + 6) % 7
  return addDaysISO(iso, -offset)
}

/** 0 = Monday … 6 = Sunday */
export const weekdayIndex = (iso: string) => (fromISODate(iso).getDay() + 6) % 7

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((fromISODate(toIso).getTime() - fromISODate(fromIso).getTime()) / 86_400_000)
}

export function formatDate(iso: string) {
  return fromISODate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "today", "tomorrow", "in 3 days", "2 days ago" */
export function relativeDay(iso: string): string {
  const diff = daysBetween(todayISO(), iso)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Mon 17" */
export const shortDay = (iso: string) =>
  fromISODate(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })

/** "eat today", "eat by tomorrow", "eat within 3 days", "overdue" */
export function eatByLabel(iso: string): string {
  const diff = daysBetween(todayISO(), iso)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'eat today'
  if (diff === 1) return 'eat by tomorrow'
  return `eat within ${diff} days`
}
