import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Edit3,
  Plus,
  Repeat2,
  Trash2,
  X,
} from 'lucide-react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  type FormEvent,
  useMemo,
  useState,
} from 'react'

import { Badge, Button, Card, Input, StatCard } from '../../../components/ui'
import { api } from '../../../lib/api'
import type {
  TeacherAvailabilityData,
  TeacherAvailabilitySlot,
  TeacherSlotProfile,
} from './types'
import './teacher-slots.css'

type ModalMode = 'single' | 'recurring' | 'block' | 'edit' | null

type SlotDraft = {
  date: string
  startTime: string
  endTime: string
  timezone: string
  subjectIds: string[]
}

type RecurringDraft = {
  startDate: string
  endDate: string
  weekdays: number[]
  startTime: string
  endTime: string
  timezone: string
  subjectIds: string[]
}

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function startOfWeek(date: Date) {
  const value = new Date(date)
  value.setHours(12, 0, 0, 0)
  const day = value.getDay()
  const offset = day === 0 ? -6 : 1 - day
  value.setDate(value.getDate() + offset)
  return value
}

function addDays(date: Date, days: number) {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

function displayDay(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`))
}

function apiMessage(error: unknown) {
  const value = error as {
    response?: { data?: { message?: string; error?: { message?: string } } }
    message?: string
  }
  return (
    value.response?.data?.message ??
    value.response?.data?.error?.message ??
    value.message ??
    'Something went wrong'
  )
}

function initialSlot(timezone: string, date = formatDateInput(new Date())): SlotDraft {
  return {
    date,
    startTime: '17:00',
    endTime: '18:00',
    timezone,
    subjectIds: [],
  }
}

function initialRecurring(timezone: string): RecurringDraft {
  const start = startOfWeek(addDays(new Date(), 7))
  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(addDays(start, 27)),
    weekdays: [1, 3, 5],
    startTime: '17:00',
    endTime: '18:00',
    timezone,
    subjectIds: [],
  }
}

export function TeacherSlotsPage() {
  const queryClient = useQueryClient()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [modal, setModal] = useState<ModalMode>(null)
  const [editing, setEditing] = useState<TeacherAvailabilitySlot | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const weekEnd = addDays(weekStart, 6)
  const start = formatDateInput(weekStart)
  const end = formatDateInput(weekEnd)

  const profileQuery = useQuery({
    queryKey: ['teacher-slot-profile'],
    queryFn: () =>
      api
        .get('/teachers/profile')
        .then((response) => response.data.data as TeacherSlotProfile),
  })

  const availabilityQuery = useQuery({
    queryKey: ['teacher-availability', start, end],
    queryFn: () =>
      api
        .get('/teachers/availability', { params: { start, end } })
        .then((response) => response.data.data as TeacherAvailabilityData),
    enabled: profileQuery.data?.profile.isApproved === true,
  })

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['teacher-availability'] }),
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] }),
    ])
  }

  const removeMutation = useMutation({
    mutationFn: (slotId: string) => api.delete(`/teachers/availability/${slotId}`),
    onSuccess: async () => {
      setNotice({ tone: 'success', message: 'Availability slot deleted.' })
      await invalidate()
    },
    onError: (error) => setNotice({ tone: 'error', message: apiMessage(error) }),
  })

  const copyMutation = useMutation({
    mutationFn: () =>
      api.post('/teachers/availability/copy-week', {
        sourceWeekStart: formatDateInput(addDays(weekStart, -7)),
        targetWeekStart: start,
      }),
    onSuccess: async (response) => {
      const result = response.data.data as { created: number; skipped: number }
      setNotice({
        tone: 'success',
        message: `Copied ${result.created} slot${result.created === 1 ? '' : 's'}; ${result.skipped} skipped.`,
      })
      await invalidate()
    },
    onError: (error) => setNotice({ tone: 'error', message: apiMessage(error) }),
  })

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = formatDateInput(addDays(weekStart, index))
        const slots = (availabilityQuery.data?.slots ?? []).filter(
          (slot) => slot.date === date,
        )
        return { date, slots }
      }),
    [availabilityQuery.data?.slots, weekStart],
  )

  function openCreateForDate(date: string) {
    setEditing({
      id: '',
      date,
      startTime: '17:00',
      endTime: '18:00',
      timezone:
        profileQuery.data?.profile.timezone ?? 'Asia/Kolkata',
      durationMinutes: 60,
      status: 'available',
      isBooked: false,
      isBlocked: false,
      isRecurring: false,
      subjects: [],
      booking: null,
      createdAt: '',
      updatedAt: '',
    })
    setModal('single')
  }

  function openEdit(slot: TeacherAvailabilitySlot) {
    setEditing(slot)
    setModal('edit')
  }

  if (profileQuery.isLoading) {
    return <TeacherSlotsSkeleton />
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="teacher-slots-page">
        <PageHeader />
        <StateCard
          icon={<AlertCircle />}
          title="Could not load your teaching profile"
          message="Check the API connection and try again."
          action={<Button onClick={() => profileQuery.refetch()}>Try again</Button>}
        />
      </div>
    )
  }

  const profile = profileQuery.data.profile

  if (!profile.isApproved) {
    return (
      <div className="teacher-slots-page">
        <PageHeader />
        <StateCard
          icon={<Ban />}
          title="Teacher approval is required"
          message="Your profile must be approved by an administrator before you can publish availability."
        />
      </div>
    )
  }

  return (
    <div className="teacher-slots-page">
      <PageHeader
        action={
          <div className="teacher-slots-header-actions">
            <Button
              className="button-secondary"
              onClick={() => {
                setEditing(null)
                setModal('recurring')
              }}
            >
              <Repeat2 size={17} /> Add recurring
            </Button>
            <Button
              onClick={() => {
                setEditing(null)
                setModal('single')
              }}
            >
              <Plus size={17} /> Add slot
            </Button>
          </div>
        }
      />

      {notice ? (
        <div className={`teacher-slots-notice ${notice.tone}`}>
          {notice.tone === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss notice">
            <X size={16} />
          </button>
        </div>
      ) : null}

      <div className="stat-grid teacher-slot-stat-grid">
        <StatCard
          label="Open slots"
          value={availabilityQuery.data?.summary.available ?? 0}
          detail="Available for booking"
          icon={<CalendarDays />}
        />
        <StatCard
          label="Booked"
          value={availabilityQuery.data?.summary.booked ?? 0}
          detail="Reserved or confirmed"
          icon={<CheckCircle2 />}
        />
        <StatCard
          label="Blocked days"
          value={availabilityQuery.data?.summary.blocked ?? 0}
          detail="Unavailable dates"
          icon={<Ban />}
        />
        <StatCard
          label="Teaching hours"
          value={availabilityQuery.data?.summary.totalHours ?? 0}
          detail="Published this week"
          icon={<Clock3 />}
        />
      </div>

      <Card className="teacher-week-toolbar">
        <div className="teacher-week-navigation">
          <Button
            className="button-secondary teacher-icon-button"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <span className="teacher-week-label">Week view</span>
            <strong>
              {displayDate(start)} – {displayDate(end)}
            </strong>
          </div>
          <Button
            className="button-secondary teacher-icon-button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Next week"
          >
            <ArrowRight size={18} />
          </Button>
        </div>

        <div className="teacher-week-actions">
          <Button
            className="button-secondary"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
          >
            Today
          </Button>
          <Button
            className="button-secondary"
            disabled={copyMutation.isPending}
            onClick={() => copyMutation.mutate()}
          >
            <Copy size={16} />
            {copyMutation.isPending ? 'Copying…' : 'Copy previous week'}
          </Button>
          <Button
            className="button-secondary"
            onClick={() => setModal('block')}
          >
            <Ban size={16} /> Block date
          </Button>
        </div>
      </Card>

      {availabilityQuery.isLoading ? (
        <TeacherSlotsSkeletonGrid />
      ) : availabilityQuery.isError ? (
        <StateCard
          icon={<AlertCircle />}
          title="Availability could not be loaded"
          message="Refresh the page or check the API server."
          action={<Button onClick={() => availabilityQuery.refetch()}>Retry</Button>}
        />
      ) : (
        <div className="teacher-week-grid">
          {days.map((day) => (
            <section className="teacher-day-column" key={day.date}>
              <header>
                <span>{displayDay(day.date).split(',')[0]}</span>
                <strong>{displayDay(day.date).replace(/^[^,]+,\s*/, '')}</strong>
                <small>
                  {day.slots.length} slot{day.slots.length === 1 ? '' : 's'}
                </small>
              </header>

              <div className="teacher-day-slots">
                {day.slots.map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    onEdit={() => openEdit(slot)}
                    onDelete={() => {
                      if (window.confirm('Delete this availability slot?')) {
                        removeMutation.mutate(slot.id)
                      }
                    }}
                  />
                ))}

                {!day.slots.some((slot) => slot.isBlocked) ? (
                  <button
                    className={
                      day.slots.length
                        ? 'teacher-day-add-more'
                        : 'teacher-day-empty'
                    }
                    onClick={() => openCreateForDate(day.date)}
                  >
                    <Plus size={17} />
                    {day.slots.length
                      ? 'Add another slot'
                      : 'Add availability'}
                  </button>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="teacher-slot-legend">
        <span><i className="available" /> Available</span>
        <span><i className="booked" /> Booked</span>
        <span><i className="blocked" /> Blocked</span>
        <span><i className="recurring" /> Recurring</span>
      </div>

      {modal ? (
        <SlotModal
          mode={modal}
          slot={editing}
          profile={profile}
          onClose={() => {
            setModal(null)
            setEditing(null)
          }}
          onSaved={async (message) => {
            setModal(null)
            setEditing(null)
            setNotice({ tone: 'success', message })
            await invalidate()
          }}
          onError={(message) => setNotice({ tone: 'error', message })}
        />
      ) : null}
    </div>
  )
}

function PageHeader({ action }: { action?: React.ReactNode }) {
  return (
    <header className="page-header teacher-slots-page-header">
      <div>
        <p className="muted">Teacher · Availability management</p>
        <h1>Manage teaching slots</h1>
        <p className="muted">
          Publish one-time or recurring availability for student bookings.
        </p>
      </div>
      {action}
    </header>
  )
}

function SlotCard({
  slot,
  onEdit,
  onDelete,
}: {
  slot: TeacherAvailabilitySlot
  onEdit: () => void
  onDelete: () => void
}) {
  const locked = slot.status === 'booked' || Boolean(slot.booking)
  const tone =
    slot.status === 'available'
      ? 'success'
      : slot.status === 'booked'
        ? 'warning'
        : slot.status === 'blocked'
          ? 'danger'
          : 'neutral'

  return (
    <article className={`teacher-slot-card ${slot.status}`}>
      <div className="teacher-slot-card-top">
        <Badge tone={tone}>{slot.status}</Badge>
        {slot.isRecurring ? <Repeat2 size={14} aria-label="Recurring" /> : null}
      </div>

      {slot.isBlocked ? (
        <>
          <strong>Unavailable all day</strong>
          <p className="muted">Students cannot book this date.</p>
        </>
      ) : (
        <>
          <strong>{slot.startTime} – {slot.endTime}</strong>
          <p className="muted">{slot.durationMinutes} minutes</p>
          <div className="teacher-slot-subjects">
            {slot.subjects.map((subject) => (
              <span key={subject.id}>{subject.name}</span>
            ))}
          </div>
          {slot.booking ? (
            <p className="teacher-slot-booking-topic">
              {slot.booking.topicName || 'Reserved lesson'}
            </p>
          ) : null}
        </>
      )}

      {!locked ? (
        <div className="teacher-slot-actions">
          {!slot.isBlocked ? (
            <button onClick={onEdit} aria-label="Edit availability">
              <Edit3 size={15} />
            </button>
          ) : null}
          <button onClick={onDelete} aria-label="Delete availability">
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <span className="teacher-slot-locked">Locked by booking</span>
      )}
    </article>
  )
}

function SlotModal({
  mode,
  slot,
  profile,
  onClose,
  onSaved,
  onError,
}: {
  mode: Exclude<ModalMode, null>
  slot: TeacherAvailabilitySlot | null
  profile: TeacherSlotProfile['profile']
  onClose: () => void
  onSaved: (message: string) => Promise<void>
  onError: (message: string) => void
}) {
  const defaultDate = slot?.date ?? formatDateInput(new Date())
  const [draft, setDraft] = useState<SlotDraft>(() => ({
    ...initialSlot(profile.timezone, defaultDate),
    startTime: slot?.startTime ?? '17:00',
    endTime: slot?.endTime ?? '18:00',
    subjectIds: slot?.subjects.map((subject) => subject.id) ?? [],
  }))
  const [recurring, setRecurring] = useState<RecurringDraft>(() =>
    initialRecurring(profile.timezone),
  )
  const [blockDate, setBlockDate] = useState(defaultDate)

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === 'recurring') {
        return api.post('/teachers/availability/recurring', recurring)
      }
      if (mode === 'block') {
        return api.post('/teachers/availability/block-date', {
          date: blockDate,
          timezone: profile.timezone,
        })
      }
      if (mode === 'edit' && slot) {
        return api.patch(`/teachers/availability/${slot.id}`, draft)
      }
      return api.post('/teachers/availability', draft)
    },
    onSuccess: async (response) => {
      if (mode === 'recurring') {
        const result = response.data.data as { created: number; skipped: number }
        await onSaved(
          `Created ${result.created} recurring slot${result.created === 1 ? '' : 's'}${result.skipped ? `; ${result.skipped} conflict${result.skipped === 1 ? '' : 's'} skipped` : ''}.`,
        )
      } else if (mode === 'block') {
        await onSaved('Date blocked successfully.')
      } else {
        await onSaved(mode === 'edit' ? 'Availability updated.' : 'Availability published.')
      }
    },
    onError: (error) => onError(apiMessage(error)),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate()
  }

  const title =
    mode === 'recurring'
      ? 'Add recurring availability'
      : mode === 'block'
        ? 'Block a date'
        : mode === 'edit'
          ? 'Edit availability'
          : 'Add availability'

  return (
    <div className="teacher-slot-modal-backdrop" role="presentation">
      <div className="teacher-slot-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <p className="muted">Manage availability</p>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={submit}>
          {mode === 'block' ? (
            <label>
              Date to block
              <Input
                min={formatDateInput(new Date())}
                onChange={(event) => setBlockDate(event.target.value)}
                required
                type="date"
                value={blockDate}
              />
              <small>
                Any unbooked availability on this date will be removed.
              </small>
            </label>
          ) : mode === 'recurring' ? (
            <>
              <div className="teacher-slot-form-grid">
                <label>
                  Start date
                  <Input
                    min={formatDateInput(new Date())}
                    onChange={(event) =>
                      setRecurring({ ...recurring, startDate: event.target.value })
                    }
                    required
                    type="date"
                    value={recurring.startDate}
                  />
                </label>
                <label>
                  End date
                  <Input
                    min={recurring.startDate}
                    onChange={(event) =>
                      setRecurring({ ...recurring, endDate: event.target.value })
                    }
                    required
                    type="date"
                    value={recurring.endDate}
                  />
                </label>
              </div>

              <fieldset className="teacher-weekday-picker">
                <legend>Repeat on</legend>
                {WEEKDAYS.map((day) => {
                  const selected = recurring.weekdays.includes(day.value)
                  return (
                    <button
                      className={selected ? 'selected' : ''}
                      key={day.value}
                      onClick={() =>
                        setRecurring({
                          ...recurring,
                          weekdays: selected
                            ? recurring.weekdays.filter((value) => value !== day.value)
                            : [...recurring.weekdays, day.value],
                        })
                      }
                      type="button"
                    >
                      {day.label}
                    </button>
                  )
                })}
              </fieldset>

              <TimeFields
                startTime={recurring.startTime}
                endTime={recurring.endTime}
                onChange={(field, value) =>
                  setRecurring({ ...recurring, [field]: value })
                }
              />

              <SubjectPicker
                subjects={profile.subjects}
                selected={recurring.subjectIds}
                onChange={(subjectIds) =>
                  setRecurring({ ...recurring, subjectIds })
                }
              />
            </>
          ) : (
            <>
              <label>
                Date
                <Input
                  min={formatDateInput(new Date())}
                  onChange={(event) =>
                    setDraft({ ...draft, date: event.target.value })
                  }
                  required
                  type="date"
                  value={draft.date}
                />
              </label>

              <TimeFields
                startTime={draft.startTime}
                endTime={draft.endTime}
                onChange={(field, value) =>
                  setDraft({ ...draft, [field]: value })
                }
              />

              <SubjectPicker
                subjects={profile.subjects}
                selected={draft.subjectIds}
                onChange={(subjectIds) =>
                  setDraft({ ...draft, subjectIds })
                }
              />
            </>
          )}

          <div className="teacher-slot-modal-actions">
            <Button
              className="button-secondary"
              disabled={mutation.isPending}
              onClick={onClose}
              type="button"
            >
              Cancel
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                (mode === 'recurring' &&
                  (recurring.weekdays.length === 0 ||
                    recurring.subjectIds.length === 0)) ||
                ((mode === 'single' || mode === 'edit') &&
                  draft.subjectIds.length === 0)
              }
              type="submit"
            >
              {mutation.isPending
                ? 'Saving…'
                : mode === 'block'
                  ? 'Block date'
                  : mode === 'edit'
                    ? 'Save changes'
                    : 'Publish availability'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TimeFields({
  startTime,
  endTime,
  onChange,
}: {
  startTime: string
  endTime: string
  onChange: (field: 'startTime' | 'endTime', value: string) => void
}) {
  return (
    <div className="teacher-slot-form-grid">
      <label>
        Start time
        <Input
          onChange={(event) => onChange('startTime', event.target.value)}
          required
          type="time"
          value={startTime}
        />
      </label>
      <label>
        End time
        <Input
          onChange={(event) => onChange('endTime', event.target.value)}
          required
          type="time"
          value={endTime}
        />
      </label>
    </div>
  )
}

function SubjectPicker({
  subjects,
  selected,
  onChange,
}: {
  subjects: { id: string; name: string }[]
  selected: string[]
  onChange: (subjectIds: string[]) => void
}) {
  return (
    <fieldset className="teacher-slot-subject-picker">
      <legend>Available for subjects</legend>
      {subjects.map((subject) => {
        const checked = selected.includes(subject.id)
        return (
          <label className={checked ? 'selected' : ''} key={subject.id}>
            <input
              checked={checked}
              onChange={() =>
                onChange(
                  checked
                    ? selected.filter((id) => id !== subject.id)
                    : [...selected, subject.id],
                )
              }
              type="checkbox"
            />
            {subject.name}
          </label>
        )
      })}
    </fieldset>
  )
}

function StateCard({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ReactNode
  title: string
  message: string
  action?: React.ReactNode
}) {
  return (
    <Card className="teacher-slots-state-card">
      {icon}
      <h3>{title}</h3>
      <p className="muted">{message}</p>
      {action}
    </Card>
  )
}

function TeacherSlotsSkeleton() {
  return (
    <div className="teacher-slots-page">
      <PageHeader />
      <TeacherSlotsSkeletonGrid />
    </div>
  )
}

function TeacherSlotsSkeletonGrid() {
  return (
    <div className="teacher-week-grid teacher-slot-skeleton-grid">
      {Array.from({ length: 7 }, (_, index) => (
        <div className="teacher-slot-skeleton" key={index} />
      ))}
    </div>
  )
}
