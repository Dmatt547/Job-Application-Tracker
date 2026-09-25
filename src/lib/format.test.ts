import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { todayISO, daysUntil, daysSince, fmtDate, relativeDate, initials, hueFor } from './format'

const TODAY = new Date('2026-09-25T09:00:00+10:00')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('todayISO', () => {
  it('returns a yyyy-mm-dd string', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('daysUntil', () => {
  it('returns null for a missing date', () => {
    expect(daysUntil(null)).toBeNull()
  })

  it('returns 0 for today', () => {
    expect(daysUntil(todayISO())).toBe(0)
  })

  it('counts forwards and backwards', () => {
    expect(daysUntil('2026-09-30')).toBe(5)
    expect(daysUntil('2026-09-20')).toBe(-5)
  })

  it('does not drift across a daylight saving boundary', () => {
    // Melbourne moves to AEDT on 4 October 2026. A naive hour-based diff
    // rounds to 89.96 days here and reports 89, which silently shifts every
    // deadline by a day for half the year.
    vi.setSystemTime(new Date('2026-10-01T09:00:00+10:00'))
    expect(daysUntil('2026-10-08')).toBe(7)
    expect(daysUntil('2026-12-30')).toBe(90)
  })
})

describe('daysSince', () => {
  it('is the inverse of daysUntil', () => {
    expect(daysSince('2026-09-20')).toBe(5)
    expect(daysSince(null)).toBeNull()
  })
})

describe('fmtDate', () => {
  it('renders an Australian short date', () => {
    expect(fmtDate('2026-09-30')).toBe('30 Sept 2026')
  })

  it('shows an em dash for nothing', () => {
    expect(fmtDate(null)).toBe('—')
  })

  it('does not throw on a malformed date', () => {
    expect(fmtDate('not-a-date')).toBe('—')
  })
})

describe('relativeDate', () => {
  it('uses words for the near cases', () => {
    expect(relativeDate(todayISO())).toBe('today')
    expect(relativeDate('2026-09-26')).toBe('tomorrow')
    expect(relativeDate('2026-09-24')).toBe('yesterday')
  })

  it('counts days either side', () => {
    expect(relativeDate('2026-10-02')).toBe('in 7 days')
    expect(relativeDate('2026-09-18')).toBe('7 days ago')
  })
})

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Culture Amp')).toBe('CA')
    expect(initials('Department of Transport')).toBe('DO')
  })

  it('takes two letters from a single word', () => {
    expect(initials('Maincode')).toBe('MA')
  })

  it('survives punctuation and messy company names', () => {
    expect(initials('REI Master P/L (REI Cloud)')).toBe('RM')
    expect(initials('  carsales  ')).toBe('CA')
  })

  it('does not throw on an empty string', () => {
    expect(initials('')).toBe('?')
  })
})

describe('hueFor', () => {
  it('is stable for the same company', () => {
    expect(hueFor('KBR')).toBe(hueFor('KBR'))
  })

  it('stays inside the hue circle', () => {
    for (const name of ['KBR', 'Maincode', 'Asta Solutions', '', 'x'.repeat(200)]) {
      const h = hueFor(name)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(360)
    }
  })
})
