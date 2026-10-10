import * as chrono from 'chrono-node'
import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/zh-cn'
import isoWeek from 'dayjs/plugin/isoWeek'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(isoWeek)
dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)
dayjs.extend(customParseFormat)
dayjs.locale('zh-cn')

export { dayjs }

/**
 * Light normalize so chrono-node zh handles relative day words more reliably,
 * then parse with chrono.zh (not hand-rolled full NLP).
 */
function normalizeRelativeDays(text: string, ref: Date): string {
  const base = dayjs(ref)
  return text
    .replace(/后天/g, base.add(2, 'day').format('YYYY年M月D日'))
    .replace(/明天/g, base.add(1, 'day').format('YYYY年M月D日'))
    .replace(/今天|今日/g, base.format('YYYY年M月D日'))
}

/** Chinese-aware NLP date parse via chrono-node */
export function parseNaturalDate(
  text: string,
  ref: Date = new Date(),
): { cleanedTitle: string; dueAt: string | null } {
  const normalized = normalizeRelativeDays(text, ref)
  const results = chrono.zh.parse(normalized, ref, { forwardDate: true })
  if (!results.length) {
    // fallback: try original text
    const fallback = chrono.zh.parse(text, ref, { forwardDate: true })
    if (!fallback.length) {
      return { cleanedTitle: text.trim(), dueAt: null }
    }
    return extractFromMatch(text, fallback[0])
  }
  // Map match back onto original text for cleaning when we normalized
  return extractFromMatch(text, results[0], normalized !== text)
}

function extractFromMatch(
  originalText: string,
  match: chrono.ParsedResult,
  usedNormalize = false,
): { cleanedTitle: string; dueAt: string | null } {
  const due = match.start.date()
  const hasTime =
    match.start.isCertain('hour') ||
    match.start.isCertain('minute') ||
    /上午|下午|晚上|凌晨|中午|\d{1,2}\s*[:：]\s*\d{1,2}|\d{1,2}\s*点/.test(match.text) ||
    /上午|下午|晚上|凌晨|中午|\d{1,2}\s*[:：]\s*\d{1,2}|\d{1,2}\s*点/.test(originalText)

  const dueAt = hasTime
    ? dayjs(due)
    : dayjs(due).hour(9).minute(0).second(0).millisecond(0)

  let cleaned: string
  if (usedNormalize) {
    // strip common date phrases from original
    cleaned = originalText
      .replace(/今天|今日|明天|后天/g, '')
      .replace(/下周[一二三四五六日天]/g, '')
      .replace(/周[一二三四五六日天]/g, '')
      .replace(/\d{1,2}\s*月\s*\d{1,2}\s*日/g, '')
      .replace(/(上午|下午|晚上|凌晨|中午)?\s*\d{1,2}\s*[:：点]\s*\d{0,2}/g, '')
      .replace(/上午|下午|晚上|凌晨|中午/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  } else {
    cleaned = (originalText.slice(0, match.index) + originalText.slice(match.index + match.text.length))
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  return {
    cleanedTitle: cleaned || originalText.trim(),
    dueAt: dueAt.toISOString(),
  }
}

export function isToday(iso?: string | null): boolean {
  if (!iso) return false
  return dayjs(iso).isSame(dayjs(), 'day')
}

export function isTomorrow(iso?: string | null): boolean {
  if (!iso) return false
  return dayjs(iso).isSame(dayjs().add(1, 'day'), 'day')
}

export function isWithinNext7Days(iso?: string | null): boolean {
  if (!iso) return false
  const d = dayjs(iso).startOf('day')
  const start = dayjs().startOf('day')
  const end = dayjs().add(6, 'day').endOf('day')
  return (d.isAfter(start) || d.isSame(start, 'day')) && d.isBefore(end)
}

export function formatDue(iso?: string | null): string {
  if (!iso) return ''
  const d = dayjs(iso)
  if (d.isSame(dayjs(), 'day')) return `今天 ${d.format('HH:mm')}`
  if (d.isSame(dayjs().add(1, 'day'), 'day')) return `明天 ${d.format('HH:mm')}`
  if (d.isSame(dayjs(), 'year')) return d.format('M月D日 HH:mm')
  return d.format('YYYY年M月D日 HH:mm')
}

export function nextRepeatDate(fromIso: string, rule: { type: string; intervalDays?: number }): string {
  const base = dayjs(fromIso)
  switch (rule.type) {
    case 'daily':
      return base.add(1, 'day').toISOString()
    case 'weekly':
      return base.add(1, 'week').toISOString()
    case 'monthly':
      return base.add(1, 'month').toISOString()
    case 'custom':
      return base.add(rule.intervalDays ?? 1, 'day').toISOString()
    default:
      return base.add(1, 'day').toISOString()
  }
}

export function startOfWeek(d: Dayjs = dayjs()): Dayjs {
  return d.startOf('isoWeek')
}
