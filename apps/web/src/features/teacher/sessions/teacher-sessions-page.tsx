import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  History,
  IndianRupee,
  MessageCircle,
  Save,
  Search,
  UserRound,
  Video,
  X,
  XCircle,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useMemo, useState } from 'react'

import { Badge, Button, Card, Input, StatCard } from '../../../components/ui'
import { api } from '../../../lib/api'
import type {
  TeacherSessionFilter,
  TeacherSessionItem,
  TeacherSessionListData,
} from './types'
import './teacher-sessions.css'

const FILTERS: Array<{ value: TeacherSessionFilter; label: string }> = [
  { value: 'all', label: 'All sessions' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

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

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'S'
  )
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value))
}

function formatTimeRange(item: TeacherSessionItem) {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: item.timezone,
  })

  return `${formatter.format(new Date(item.scheduledAt))}–${formatter.format(
    new Date(item.endAt),
  )}`
}

function statusLabel(item: TeacherSessionItem) {
  if (item.status === 'completed') return 'Completed'
  if (item.status === 'cancelled') return 'Cancelled'
  if (item.status === 'rejected') return 'Declined'
  if (item.status === 'rescheduled') return 'Rescheduled'

  const now = Date.now()
  const start = new Date(item.scheduledAt).getTime()
  const end = new Date(item.endAt).getTime()

  if (start <= now && end >= now) return 'Live now'
  return 'Upcoming'
}

function statusTone(item: TeacherSessionItem) {
  const label = statusLabel(item)
  if (label === 'Live now' || label === 'Completed') return 'success' as const
  if (label === 'Cancelled' || label === 'Declined') return 'danger' as const
  if (label === 'Rescheduled') return 'purple' as const
  return 'warning' as const
}

function canComplete(item: TeacherSessionItem) {
  return (
    ['accepted', 'upcoming', 'rescheduled'].includes(item.status) &&
    new Date(item.scheduledAt).getTime() <= Date.now()
  )
}

export function TeacherSessionsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<TeacherSessionFilter>('all')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<TeacherSessionItem | null>(null)
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error'
    message: string
  } | null>(null)

  const query = useQuery({
    queryKey: ['teacher-sessions', filter, search, page],
    queryFn: () =>
      api
        .get('/teacher-sessions', {
          params: { status: filter, search, page, limit: 10 },
        })
        .then((response) => response.data.data as TeacherSessionListData),
    refetchOnWindowFocus: true,
  })

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['teacher-sessions'] }),
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['teacher-bookings'] }),
      queryClient.invalidateQueries({ queryKey: ['student-sessions'] }),
    ])
  }

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      meetingLink,
      teacherNote,
    }: {
      id: string
      meetingLink: string
      teacherNote: string
    }) =>
      api.patch(`/teacher-sessions/${id}/details`, {
        meetingLink,
        teacherNote,
      }),
    onSuccess: async () => {
      setSelected(null)
      setNotice({
        tone: 'success',
        message: 'Session details updated successfully.',
      })
      await invalidate()
    },
    onError: (error) =>
      setNotice({ tone: 'error', message: apiMessage(error) }),
  })

  const completeMutation = useMutation({
    mutationFn: ({ id, teacherNote }: { id: string; teacherNote: string }) =>
      api.patch(`/teacher-sessions/${id}/complete`, { teacherNote }),
    onSuccess: async () => {
      setSelected(null)
      setNotice({
        tone: 'success',
        message: 'Session marked as completed.',
      })
      await invalidate()
    },
    onError: (error) =>
      setNotice({ tone: 'error', message: apiMessage(error) }),
  })

  const selectedIsActive = useMemo(
    () =>
      selected
        ? ['accepted', 'upcoming', 'rescheduled'].includes(selected.status)
        : false,
    [selected],
  )

  if (query.isLoading) {
    return <TeacherSessionsSkeleton />
  }

  if (query.isError || !query.data) {
    return (
      <div className="teacher-sessions-page">
        <Card className="teacher-sessions-state-card">
          <AlertCircle size={36} />
          <h2>Could not load teaching sessions</h2>
          <p>{apiMessage(query.error)}</p>
          <Button onClick={() => query.refetch()}>Try again</Button>
        </Card>
      </div>
    )
  }

  const data = query.data

  return (
    <div className="teacher-sessions-page">
      <header className="teacher-sessions-header">
        <div>
          <p>Teacher · Session management</p>
          <h1>Teaching sessions</h1>
          <span>
            Prepare meeting links, review student doubts, join lessons and keep
            your session history updated.
          </span>
        </div>
        <div className="teacher-sessions-header-actions">
          <Button
            className="secondary"
            onClick={() => window.location.assign('/teacher/bookings')}
          >
            <BookOpen size={17} /> Booking requests
          </Button>
          <Button onClick={() => window.location.assign('/teacher/slots')}>
            <CalendarClock size={17} /> Manage slots
          </Button>
        </div>
      </header>

      {notice ? (
        <div className={`teacher-sessions-notice ${notice.tone}`}>
          {notice.tone === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{notice.message}</span>
          <button aria-label="Dismiss" onClick={() => setNotice(null)}>
            <X size={16} />
          </button>
        </div>
      ) : null}

      <section className="teacher-sessions-summary">
        <StatCard
          label="Today's sessions"
          value={data.summary.today}
          icon={<CalendarClock size={21} />}
          detail="Booked lessons today"
        />
        <StatCard
          label="Live now"
          value={data.summary.live}
          icon={<Video size={21} />}
          detail="Currently in progress"
        />
        <StatCard
          label="Upcoming"
          value={data.summary.upcoming}
          icon={<Clock3 size={21} />}
          detail="Confirmed sessions"
        />
        <StatCard
          label="Completed"
          value={data.summary.completed}
          icon={<CheckCircle2 size={21} />}
          detail="Session history"
        />
      </section>

      <Card className="teacher-sessions-toolbar">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setSearch(searchDraft.trim())
            setPage(1)
          }}
        >
          <Search size={18} />
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search student, subject, chapter or doubt"
          />
          <Button type="submit">Search</Button>
          {search ? (
            <Button
              type="button"
              className="secondary"
              onClick={() => {
                setSearchDraft('')
                setSearch('')
                setPage(1)
              }}
            >
              Clear
            </Button>
          ) : null}
        </form>

        <div className="teacher-sessions-tabs">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              className={filter === item.value ? 'active' : ''}
              onClick={() => {
                setFilter(item.value)
                setPage(1)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {data.items.length ? (
        <section className="teacher-session-list">
          {data.items.map((item) => (
            <SessionCard
              key={item.id}
              item={item}
              onManage={() => setSelected(item)}
              onComplete={() => {
                if (
                  window.confirm(
                    'Mark this lesson as completed? The student will be able to leave feedback.',
                  )
                ) {
                  completeMutation.mutate({
                    id: item.id,
                    teacherNote: item.teacherNote,
                  })
                }
              }}
            />
          ))}
        </section>
      ) : (
        <Card className="teacher-sessions-empty">
          <History size={35} />
          <h2>No matching sessions</h2>
          <p>
            Accepted student bookings will appear here. Open more availability
            to receive new lesson requests.
          </p>
          <Button onClick={() => window.location.assign('/teacher/slots')}>
            Publish availability
          </Button>
        </Card>
      )}

      <div className="teacher-sessions-pagination">
        <Button
          className="secondary"
          disabled={data.pagination.page <= 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          <ArrowLeft size={16} /> Previous
        </Button>
        <span>
          Page {data.pagination.page} of {data.pagination.pages}
        </span>
        <Button
          className="secondary"
          disabled={data.pagination.page >= data.pagination.pages}
          onClick={() => setPage((value) => value + 1)}
        >
          Next <ArrowRight size={16} />
        </Button>
      </div>

      {selected ? (
        <SessionDetailsModal
          item={selected}
          isActive={selectedIsActive}
          saving={updateMutation.isPending || completeMutation.isPending}
          onClose={() => setSelected(null)}
          onSave={(meetingLink, teacherNote) =>
            updateMutation.mutate({
              id: selected.id,
              meetingLink,
              teacherNote,
            })
          }
          onComplete={(teacherNote) =>
            completeMutation.mutate({ id: selected.id, teacherNote })
          }
        />
      ) : null}
    </div>
  )
}

function SessionCard({
  item,
  onManage,
  onComplete,
}: {
  item: TeacherSessionItem
  onManage: () => void
  onComplete: () => void
}) {
  const label = statusLabel(item)

  return (
    <Card className="teacher-session-card">
      <div className="teacher-session-card-top">
        <div className="teacher-session-student">
          <div className="teacher-session-avatar">
            {item.student.avatar ? (
              <img src={item.student.avatar} alt="" />
            ) : (
              initials(item.student.name)
            )}
          </div>
          <div>
            <strong>{item.student.name}</strong>
            <span>
              {item.student.grade ? `Standard ${item.student.grade}` : 'Student'}
            </span>
          </div>
        </div>
        <Badge tone={statusTone(item)}>{label}</Badge>
      </div>

      <div className="teacher-session-main">
        <div className="teacher-session-time-panel">
          <CalendarClock size={20} />
          <div>
            <strong>{formatDateTime(item.scheduledAt, item.timezone)}</strong>
            <span>
              {formatTimeRange(item)} · {item.durationMinutes} minutes
            </span>
          </div>
        </div>

        <div className="teacher-session-meta-grid">
          <div>
            <BookOpen size={17} />
            <span>Subject</span>
            <strong>{item.subject.name}</strong>
          </div>
          <div>
            <MessageCircle size={17} />
            <span>Chapter</span>
            <strong>{item.topicName}</strong>
          </div>
          <div>
            <IndianRupee size={17} />
            <span>Payment</span>
            <strong>
              {item.payment
                ? `₹${item.payment.totalAmount.toLocaleString('en-IN')}`
                : item.paymentStatus}
            </strong>
          </div>
        </div>

        {item.doubt ? (
          <div className="teacher-session-doubt">
            <div>
              <MessageCircle size={17} />
              <strong>Student doubt</strong>
            </div>
            <p>{item.doubt.title}</p>
            {item.doubt.description ? <span>{item.doubt.description}</span> : null}
          </div>
        ) : null}

        {item.studentNote ? (
          <div className="teacher-session-note">
            <span>Student note</span>
            <p>{item.studentNote}</p>
          </div>
        ) : null}
      </div>

      <div className="teacher-session-card-actions">
        <Button className="secondary" onClick={onManage}>
          <Save size={16} /> Manage details
        </Button>
        {item.meetingLink && !['completed', 'cancelled', 'rejected'].includes(item.status) ? (
          <Button onClick={() => window.open(item.meetingLink!, '_blank', 'noopener,noreferrer')}>
            <Video size={16} /> Join session
          </Button>
        ) : null}
        {canComplete(item) ? (
          <Button className="success" onClick={onComplete}>
            <CheckCircle2 size={16} /> Mark completed
          </Button>
        ) : null}
      </div>
    </Card>
  )
}

function SessionDetailsModal({
  item,
  isActive,
  saving,
  onClose,
  onSave,
  onComplete,
}: {
  item: TeacherSessionItem
  isActive: boolean
  saving: boolean
  onClose: () => void
  onSave: (meetingLink: string, teacherNote: string) => void
  onComplete: (teacherNote: string) => void
}) {
  const [meetingLink, setMeetingLink] = useState(item.meetingLink ?? '')
  const [teacherNote, setTeacherNote] = useState(item.teacherNote)

  function submit(event: FormEvent) {
    event.preventDefault()
    onSave(meetingLink.trim(), teacherNote.trim())
  }

  return (
    <div className="teacher-session-modal-backdrop" onMouseDown={onClose}>
      <div
        className="card teacher-session-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="teacher-session-modal-header">
          <div>
            <span>Session details</span>
            <h2>{item.student.name} · {item.subject.name}</h2>
          </div>
          <button aria-label="Close" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        <div className="teacher-session-modal-summary">
          <div>
            <CalendarClock size={18} />
            <span>{formatDateTime(item.scheduledAt, item.timezone)}</span>
          </div>
          <div>
            <Clock3 size={18} />
            <span>{item.durationMinutes} minutes</span>
          </div>
          <div>
            <UserRound size={18} />
            <span>{item.student.email || 'No email available'}</span>
          </div>
        </div>

        <form onSubmit={submit}>
          <label>
            <span>Meeting link</span>
            <Input
              value={meetingLink}
              onChange={(event) => setMeetingLink(event.target.value)}
              placeholder="https://meet.google.com/..."
              disabled={!isActive}
            />
            <small>
              Add Google Meet, Zoom or another secure classroom link.
            </small>
          </label>

          <label>
            <span>Preparation and session notes</span>
            <textarea
              value={teacherNote}
              onChange={(event) => setTeacherNote(event.target.value)}
              rows={6}
              maxLength={1500}
              placeholder="Topics to cover, examples to prepare, homework or completion summary..."
              disabled={!isActive && item.status !== 'completed'}
            />
          </label>

          {item.doubt ? (
            <div className="teacher-session-modal-doubt">
              <strong>Linked doubt</strong>
              <p>{item.doubt.title}</p>
              {item.doubt.description ? <span>{item.doubt.description}</span> : null}
            </div>
          ) : null}

          <div className="teacher-session-modal-actions">
            <Button type="button" className="secondary" onClick={onClose}>
              Close
            </Button>
            {item.meetingLink ? (
              <Button
                type="button"
                className="secondary"
                onClick={() => window.open(item.meetingLink!, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink size={16} /> Open meeting
              </Button>
            ) : null}
            {isActive ? (
              <Button type="submit" disabled={saving}>
                <Save size={16} /> {saving ? 'Saving…' : 'Save details'}
              </Button>
            ) : null}
            {canComplete(item) ? (
              <Button
                type="button"
                className="success"
                disabled={saving}
                onClick={() => onComplete(teacherNote.trim())}
              >
                <CheckCircle2 size={16} /> Mark completed
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}

function TeacherSessionsSkeleton() {
  return (
    <div className="teacher-sessions-page teacher-sessions-loading">
      <div className="teacher-session-skeleton wide" />
      <div className="teacher-sessions-summary">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="teacher-session-skeleton stat" key={index} />
        ))}
      </div>
      <div className="teacher-session-skeleton toolbar" />
      {Array.from({ length: 3 }, (_, index) => (
        <div className="teacher-session-skeleton card" key={index} />
      ))}
    </div>
  )
}
