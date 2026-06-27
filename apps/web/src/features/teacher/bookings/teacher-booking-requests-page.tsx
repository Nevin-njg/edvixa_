import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  IndianRupee,
  MessageCircle,
  Search,
  Star,
  UserRound,
  Users,
  X,
  XCircle,
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
  TeacherAvailableSlot,
  TeacherBookingFilter,
  TeacherBookingItem,
  TeacherBookingListData,
} from './types'
import './teacher-booking-requests.css'

const FILTERS: Array<{ value: TeacherBookingFilter; label: string }> = [
  { value: 'all', label: 'All requests' },
  { value: 'pending', label: 'Pending' },
  { value: 'upcoming', label: 'Accepted' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Declined' },
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

function formatSlot(slot: TeacherAvailableSlot) {
  return `${new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${slot.date}T12:00:00`))} · ${slot.startTime}–${slot.endTime}`
}

function toneForStatus(status: TeacherBookingItem['status']) {
  if (status === 'pending') return 'warning' as const
  if (status === 'rejected' || status === 'cancelled') return 'danger' as const
  if (status === 'completed') return 'purple' as const
  return 'success' as const
}

function humanStatus(status: TeacherBookingItem['status']) {
  if (status === 'upcoming' || status === 'accepted') return 'Accepted'
  if (status === 'rescheduled') return 'Rescheduled'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase())
    .join('') || 'S'
}

export function TeacherBookingRequestsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<TeacherBookingFilter>('all')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<TeacherBookingItem | null>(null)
  const [modal, setModal] = useState<'details' | 'accept' | 'decline' | 'suggest' | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const query = useQuery({
    queryKey: ['teacher-bookings', status, search, page],
    queryFn: () =>
      api
        .get('/teacher-bookings', {
          params: { status, search, page, limit: 10 },
        })
        .then((response) => response.data.data as TeacherBookingListData),
    refetchOnWindowFocus: true,
  })

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['teacher-bookings'] }),
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['teacher-availability'] }),
    ])
  }

  const acceptMutation = useMutation({
    mutationFn: ({ id, note, meetingLink }: { id: string; note: string; meetingLink: string }) =>
      api.patch(`/teacher-bookings/${id}/accept`, { note, meetingLink }),
    onSuccess: async () => {
      setNotice({ tone: 'success', message: 'Booking request accepted.' })
      setModal(null)
      setSelected(null)
      await invalidate()
    },
    onError: (error) => setNotice({ tone: 'error', message: apiMessage(error) }),
  })

  const declineMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.patch(`/teacher-bookings/${id}/decline`, { note }),
    onSuccess: async () => {
      setNotice({ tone: 'success', message: 'Booking request declined.' })
      setModal(null)
      setSelected(null)
      await invalidate()
    },
    onError: (error) => setNotice({ tone: 'error', message: apiMessage(error) }),
  })

  const suggestMutation = useMutation({
    mutationFn: ({ id, slotId, note }: { id: string; slotId: string; note: string }) =>
      api.patch(`/teacher-bookings/${id}/suggest-slot`, { slotId, note }),
    onSuccess: async () => {
      setNotice({ tone: 'success', message: 'The booking was moved to the suggested slot.' })
      setModal(null)
      setSelected(null)
      await invalidate()
    },
    onError: (error) => setNotice({ tone: 'error', message: apiMessage(error) }),
  })

  const filteredSlots = useMemo(() => {
    if (!selected) return query.data?.availableSlots ?? []
    return (query.data?.availableSlots ?? []).filter(
      (slot) => new Date(slot.scheduledAt).getTime() > Date.now(),
    )
  }, [query.data?.availableSlots, selected])

  function openModal(item: TeacherBookingItem, nextModal: typeof modal) {
    setSelected(item)
    setModal(nextModal)
  }

  if (query.isLoading) {
    return <BookingRequestsSkeleton />
  }

  if (query.isError || !query.data) {
    return (
      <div className="teacher-bookings-page">
        <div className="teacher-bookings-state-card">
          <AlertCircle size={36} />
          <h2>Could not load booking requests</h2>
          <p>{apiMessage(query.error)}</p>
          <Button onClick={() => query.refetch()}>Try again</Button>
        </div>
      </div>
    )
  }

  const data = query.data

  return (
    <div className="teacher-bookings-page">
      <header className="teacher-bookings-header">
        <div>
          <p>Teacher · Booking management</p>
          <h1>Booking requests</h1>
          <span>Review paid student requests, prepare for their doubts, and confirm the lesson.</span>
        </div>
        <Button className="secondary" onClick={() => window.location.assign('/teacher/slots')}>
          <CalendarClock size={17} /> Manage slots
        </Button>
      </header>

      {notice ? (
        <div className={`teacher-bookings-notice ${notice.tone}`}>
          {notice.tone === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{notice.message}</span>
          <button aria-label="Dismiss" onClick={() => setNotice(null)}><X size={16} /></button>
        </div>
      ) : null}

      <section className="teacher-bookings-summary">
        <StatCard label="Pending requests" value={data.summary.pending} icon={<BookOpen size={21} />} detail="Awaiting your response" />
        <StatCard label="Accepted" value={data.summary.upcoming} icon={<BadgeCheck size={21} />} detail="Upcoming lessons" />
        <StatCard label="Completed" value={data.summary.completed} icon={<CheckCircle2 size={21} />} detail="Delivered lessons" />
        <StatCard label="Declined" value={data.summary.rejected} icon={<XCircle size={21} />} detail="Refunds or releases" />
      </section>

      <Card className="teacher-bookings-toolbar">
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
        <div className="teacher-bookings-tabs">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              className={status === filter.value ? 'active' : ''}
              onClick={() => {
                setStatus(filter.value)
                setPage(1)
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </Card>

      {data.items.length ? (
        <section className="teacher-booking-list">
          {data.items.map((item) => (
            <BookingRequestCard
              key={item.id}
              item={item}
              onDetails={() => openModal(item, 'details')}
              onAccept={() => openModal(item, 'accept')}
              onDecline={() => openModal(item, 'decline')}
              onSuggest={() => openModal(item, 'suggest')}
            />
          ))}
        </section>
      ) : (
        <Card className="teacher-bookings-empty">
          <BookOpen size={34} />
          <h2>No matching booking requests</h2>
          <p>New paid student requests will appear here. Publish more availability to receive bookings.</p>
          <Button onClick={() => window.location.assign('/teacher/slots')}>Publish availability</Button>
        </Card>
      )}

      <div className="teacher-bookings-pagination">
        <Button
          className="secondary"
          disabled={data.pagination.page <= 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          <ArrowLeft size={16} /> Previous
        </Button>
        <span>Page {data.pagination.page} of {data.pagination.pages}</span>
        <Button
          className="secondary"
          disabled={data.pagination.page >= data.pagination.pages}
          onClick={() => setPage((value) => value + 1)}
        >
          Next <ArrowRight size={16} />
        </Button>
      </div>

      {selected && modal === 'details' ? (
        <DetailsModal item={selected} onClose={() => setModal(null)} />
      ) : null}

      {selected && modal === 'accept' ? (
        <AcceptModal
          item={selected}
          busy={acceptMutation.isPending}
          onClose={() => setModal(null)}
          onSubmit={(note, meetingLink) =>
            acceptMutation.mutate({ id: selected.id, note, meetingLink })
          }
        />
      ) : null}

      {selected && modal === 'decline' ? (
        <DeclineModal
          item={selected}
          busy={declineMutation.isPending}
          onClose={() => setModal(null)}
          onSubmit={(note) => declineMutation.mutate({ id: selected.id, note })}
        />
      ) : null}

      {selected && modal === 'suggest' ? (
        <SuggestSlotModal
          item={selected}
          slots={filteredSlots}
          busy={suggestMutation.isPending}
          onClose={() => setModal(null)}
          onSubmit={(slotId, note) =>
            suggestMutation.mutate({ id: selected.id, slotId, note })
          }
        />
      ) : null}
    </div>
  )
}

function BookingRequestCard({
  item,
  onDetails,
  onAccept,
  onDecline,
  onSuggest,
}: {
  item: TeacherBookingItem
  onDetails: () => void
  onAccept: () => void
  onDecline: () => void
  onSuggest: () => void
}) {
  const isPending = item.status === 'pending'

  return (
    <Card className="teacher-booking-card">
      <div className="teacher-booking-card-top">
        <div className="teacher-booking-student">
          <div className="teacher-booking-avatar">
            {item.student.avatar ? <img src={item.student.avatar} alt="" /> : initials(item.student.name)}
          </div>
          <div>
            <div className="teacher-booking-name-row">
              <h2>{item.student.name}</h2>
              <Badge tone={toneForStatus(item.status)}>{humanStatus(item.status)}</Badge>
            </div>
            <p>{item.student.grade ? `Standard ${item.student.grade}` : 'Standard not added'} · {item.student.email}</p>
          </div>
        </div>
        <div className="teacher-booking-schedule">
          <CalendarClock size={19} />
          <div>
            <strong>{formatDateTime(item.scheduledAt, item.timezone)}</strong>
            <span>{item.durationMinutes} minutes · {item.timezone}</span>
          </div>
        </div>
      </div>

      <div className="teacher-booking-info-grid">
        <div><BookOpen size={17} /><span>Subject</span><strong>{item.subject.name}</strong></div>
        <div><Star size={17} /><span>Chapter</span><strong>{item.topicName}</strong></div>
        <div><IndianRupee size={17} /><span>Payment</span><strong>{item.payment ? `₹${item.payment.totalAmount}` : item.paymentStatus}</strong></div>
        <div><Clock3 size={17} /><span>Requested</span><strong>{formatDateTime(item.createdAt, item.timezone)}</strong></div>
      </div>

      {item.doubt ? (
        <div className="teacher-booking-doubt">
          <div><MessageCircle size={18} /><strong>Student doubt</strong></div>
          <p>{item.doubt.title}</p>
          {item.doubt.description ? <span>{item.doubt.description}</span> : null}
          <small><Users size={14} /> {item.doubt.votes} student{item.doubt.votes === 1 ? '' : 's'} share this doubt · {item.doubt.comments} comments</small>
        </div>
      ) : null}

      {item.studentNote ? (
        <div className="teacher-booking-note"><strong>Student note:</strong> {item.studentNote}</div>
      ) : null}

      <div className="teacher-booking-card-actions">
        <Button className="secondary" onClick={onDetails}>View details</Button>
        {isPending ? (
          <>
            <Button className="secondary" onClick={onSuggest}><CalendarClock size={16} /> Suggest time</Button>
            <Button className="danger" onClick={onDecline}><X size={16} /> Decline</Button>
            <Button onClick={onAccept}><Check size={16} /> Accept request</Button>
          </>
        ) : item.status === 'upcoming' || item.status === 'accepted' || item.status === 'rescheduled' ? (
          <Button onClick={() => window.location.assign('/teacher/sessions')}>Open session</Button>
        ) : null}
      </div>
    </Card>
  )
}

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="teacher-booking-modal-backdrop" onMouseDown={onClose}>
      <section className="teacher-booking-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><h2>{title}</h2><p>{subtitle}</p></div>
          <button aria-label="Close" onClick={onClose}><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>
  )
}

function DetailsModal({ item, onClose }: { item: TeacherBookingItem; onClose: () => void }) {
  return (
    <ModalShell title="Booking request details" subtitle={`${item.student.name} · ${item.subject.name}`} onClose={onClose}>
      <div className="teacher-booking-detail-grid">
        <div><span>Student</span><strong>{item.student.name}</strong><small>{item.student.email}</small></div>
        <div><span>Standard</span><strong>{item.student.grade ?? 'Not added'}</strong></div>
        <div><span>Subject</span><strong>{item.subject.name}</strong></div>
        <div><span>Chapter</span><strong>{item.topicName}</strong></div>
        <div><span>Schedule</span><strong>{formatDateTime(item.scheduledAt, item.timezone)}</strong></div>
        <div><span>Payment</span><strong>{item.payment ? `₹${item.payment.totalAmount} · ${item.payment.status}` : item.paymentStatus}</strong></div>
      </div>
      {item.doubt ? <div className="teacher-booking-modal-copy"><strong>Doubt</strong><p>{item.doubt.title}</p>{item.doubt.description ? <span>{item.doubt.description}</span> : null}</div> : null}
      {item.studentNote ? <div className="teacher-booking-modal-copy"><strong>Student note</strong><p>{item.studentNote}</p></div> : null}
      {item.teacherNote ? <div className="teacher-booking-modal-copy"><strong>Teacher note</strong><p>{item.teacherNote}</p></div> : null}
      <div className="teacher-booking-modal-actions"><Button className="secondary" onClick={onClose}>Close</Button></div>
    </ModalShell>
  )
}

function AcceptModal({
  item,
  busy,
  onClose,
  onSubmit,
}: {
  item: TeacherBookingItem
  busy: boolean
  onClose: () => void
  onSubmit: (note: string, meetingLink: string) => void
}) {
  const [note, setNote] = useState('')
  const [meetingLink, setMeetingLink] = useState('')

  return (
    <ModalShell title="Accept booking request" subtitle={`${item.student.name} · ${formatDateTime(item.scheduledAt, item.timezone)}`} onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(note, meetingLink) }}>
        <label>Preparation note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What will you cover in this lesson?" maxLength={1000} /></label>
        <label>Meeting link <span>(optional)</span><Input value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} placeholder="https://meet.google.com/..." /></label>
        <div className="teacher-booking-modal-actions"><Button type="button" className="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy ? 'Accepting...' : 'Accept request'}</Button></div>
      </form>
    </ModalShell>
  )
}

function DeclineModal({
  item,
  busy,
  onClose,
  onSubmit,
}: {
  item: TeacherBookingItem
  busy: boolean
  onClose: () => void
  onSubmit: (note: string) => void
}) {
  const [note, setNote] = useState('')

  return (
    <ModalShell title="Decline booking request" subtitle={`${item.student.name} will be notified and the slot will be released.`} onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(note) }}>
        <label>Reason<textarea required minLength={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain why this request cannot be accepted." maxLength={500} /></label>
        <p className="teacher-booking-refund-note">Demo payments are refunded immediately. Razorpay payments are marked for refund processing.</p>
        <div className="teacher-booking-modal-actions"><Button type="button" className="secondary" onClick={onClose}>Keep request</Button><Button className="danger" disabled={busy || note.trim().length < 3}>{busy ? 'Declining...' : 'Decline request'}</Button></div>
      </form>
    </ModalShell>
  )
}

function SuggestSlotModal({
  item,
  slots,
  busy,
  onClose,
  onSubmit,
}: {
  item: TeacherBookingItem
  slots: TeacherAvailableSlot[]
  busy: boolean
  onClose: () => void
  onSubmit: (slotId: string, note: string) => void
}) {
  const [slotId, setSlotId] = useState('')
  const [note, setNote] = useState('')

  return (
    <ModalShell title="Suggest another time" subtitle={`${item.student.name} · ${item.subject.name}`} onClose={onClose}>
      <form onSubmit={(event: FormEvent) => { event.preventDefault(); onSubmit(slotId, note) }}>
        <label>Available slot<select required value={slotId} onChange={(event) => setSlotId(event.target.value)}><option value="">Select another published slot</option>{slots.map((slot) => <option key={slot.id} value={slot.id}>{formatSlot(slot)}</option>)}</select></label>
        <label>Message to student<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain why you are suggesting this time." maxLength={500} /></label>
        {!slots.length ? <p className="teacher-booking-refund-note">No other open slots are available. Publish a new slot first.</p> : null}
        <div className="teacher-booking-modal-actions"><Button type="button" className="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy || !slotId}>{busy ? 'Updating...' : 'Suggest this time'}</Button></div>
      </form>
    </ModalShell>
  )
}

function BookingRequestsSkeleton() {
  return (
    <div className="teacher-bookings-page teacher-bookings-loading">
      <div className="teacher-bookings-skeleton wide" />
      <div className="teacher-bookings-summary">{Array.from({ length: 4 }, (_, index) => <div className="teacher-bookings-skeleton" key={index} />)}</div>
      <div className="teacher-bookings-skeleton toolbar" />
      <div className="teacher-bookings-skeleton card" />
      <div className="teacher-bookings-skeleton card" />
    </div>
  )
}
