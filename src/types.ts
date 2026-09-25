export const STATUSES = [
  'Not applied',
  'Applied',
  'Pending',
  'Heard back',
  'Interview',
  'Offer',
  'Rejected',
  'Withdrawn',
] as const

export type Status = (typeof STATUSES)[number]

/** Statuses that still represent a live opportunity. */
export const OPEN_STATUSES: Status[] = [
  'Not applied',
  'Applied',
  'Pending',
  'Heard back',
  'Interview',
  'Offer',
]

/** Columns shown on the board, in pipeline order. */
export const BOARD_COLUMNS: Status[] = [
  'Not applied',
  'Applied',
  'Pending',
  'Heard back',
  'Interview',
  'Offer',
]

export const SOURCES = [
  'Seek',
  'LinkedIn',
  'Grad program',
  'Company site',
  'Referral',
  'Recruiter',
  'Other',
] as const
export type Source = (typeof SOURCES)[number]

export const PRIORITIES = ['High', 'Medium', 'Low'] as const
export type Priority = (typeof PRIORITIES)[number]

export interface Job {
  id: string
  company: string
  role: string
  location: string
  link: string
  source: Source
  priority: Priority
  status: Status
  /** All dates are ISO yyyy-mm-dd strings, or null. */
  date_found: string | null
  date_applied: string | null
  deadline: string | null
  last_update: string | null
  next_action: string
  next_action_due: string | null
  notes: string
  created_at: string
  updated_at: string
}

export type JobDraft = Omit<Job, 'id' | 'created_at' | 'updated_at'>

export function emptyDraft(today: string): JobDraft {
  return {
    company: '',
    role: '',
    location: '',
    link: '',
    source: 'Seek',
    priority: 'Medium',
    status: 'Not applied',
    date_found: today,
    date_applied: null,
    deadline: null,
    last_update: null,
    next_action: '',
    next_action_due: null,
    notes: '',
  }
}
