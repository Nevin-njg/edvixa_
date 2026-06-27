import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  IndianRupee,
  MessageCircleQuestion,
  Sparkles,
  Star,
  TrendingUp,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge, Button, Card, StatCard } from '../../../components/ui'
import { api } from '../../../lib/api'
import { useAuthStore } from '../../../stores/auth.store'
import type {
  TeacherDashboardAvailability,
  TeacherDashboardData,
  TeacherDashboardSession,
} from './types'
import './teacher-dashboard.css'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function dateKeyInTimeZone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value
    return year && month && day ? `${year}-${month}-${day}` : ''
  } catch {
    return date.toISOString().slice(0, 10)
  }
}


function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function SessionRow({ session, compact = false }: { session: TeacherDashboardSession; compact?: boolean }) {
  const canJoin = Boolean(session.meetingLink)
  return (
    <article className={`teacher-dashboard-session ${compact ? 'compact' : ''}`}>
      <div className="teacher-dashboard-avatar">
        {session.student.avatar ? (
          <img src={session.student.avatar} alt="" />
        ) : (
          <span>{initials(session.student.name)}</span>
        )}
      </div>
      <div className="teacher-dashboard-session-copy">
        <div className="teacher-dashboard-session-title">
          <strong>{session.topicName}</strong>
          <Badge tone={session.status === 'completed' ? 'success' : 'purple'}>
            {session.status}
          </Badge>
        </div>
        <p>
          {session.student.name} · {session.subject.name}
          {session.studentGrade ? ` · Grade ${session.studentGrade}` : ''}
        </p>
        <div className="teacher-dashboard-session-meta">
          <span><CalendarDays size={14} />{formatDate(session.scheduledAt)}</span>
          <span><Clock3 size={14} />{formatTime(session.scheduledAt)}–{formatTime(session.endAt)}</span>
        </div>
      </div>
      {!compact && (
        canJoin ? (
          <a className="button teacher-dashboard-session-action" href={session.meetingLink ?? undefined} target="_blank" rel="noreferrer">
            Join session
          </a>
        ) : (
          <Link className="button button-secondary teacher-dashboard-session-action" to="/teacher/sessions">
            View details
          </Link>
        )
      )}
    </article>
  )
}

function AvailabilityRow({ slot }: { slot: TeacherDashboardAvailability }) {
  const subjectNames = slot.subjects.map((subject) => subject.name).join(', ')
  return (
    <article className="teacher-dashboard-availability">
      <div className="teacher-dashboard-availability-icon">
        <CalendarClock size={21} />
      </div>
      <div>
        <div className="teacher-dashboard-availability-title">
          <strong>{slot.startTime}–{slot.endTime}</strong>
          <Badge tone="success">open slot</Badge>
        </div>
        <p>{subjectNames || 'Any approved subject'} · {slot.durationMinutes} minutes</p>
      </div>
      <Link className="button button-secondary teacher-dashboard-session-action" to="/teacher/slots">
        Manage slot
      </Link>
    </article>
  )
}

function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="teacher-dashboard-empty">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="teacher-dashboard-skeleton-grid">
      {Array.from({ length: 8 }, (_, index) => (
        <div className="skeleton" key={index} />
      ))}
    </div>
  )
}

export function TeacherDashboardPage() {
  const user = useAuthStore((state) => state.user)!
  const { data, isLoading, isError, refetch } = useQuery<TeacherDashboardData>({
    queryKey: ['teacher-dashboard-v3'],
    queryFn: () => api.get('/teachers/dashboard').then((response) => response.data.data),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (isError || !data) {
    return (
      <Card className="teacher-dashboard-error">
        <h2>Dashboard could not be loaded</h2>
        <p className="muted">Check that the API and MongoDB are running, then try again.</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </Card>
    )
  }

  const maxWeeklyEarning = Math.max(...data.weeklyEarnings.map((item) => item.amount), 1)
  const now = Date.now()
  const todayBookedSessions = data.todaySessions
    .filter((session) => new Date(session.endAt).getTime() >= now)
    .sort(
      (first, second) =>
        new Date(first.scheduledAt).getTime() -
        new Date(second.scheduledAt).getTime(),
    )
  const todayOpenAvailability = data.upcomingAvailability.filter((slot) => (
    slot.date === dateKeyInTimeZone(new Date(), slot.timezone)
  ))
  const statusTone = data.applicationStatus === 'approved'
    ? 'success'
    : data.applicationStatus === 'rejected'
      ? 'danger'
      : data.applicationStatus === 'pending'
        ? 'warning'
        : 'neutral'

  return (
    <div className="teacher-dashboard-page">
      <header className="teacher-dashboard-header">
        <div>
          <div className="teacher-dashboard-eyebrow">
            <Badge tone={statusTone}>{data.applicationStatus}</Badge>
            <span>{data.profile.profileCompletedPercent}% profile complete</span>
          </div>
          <h1>Welcome back, {user.name.split(' ')[0]}</h1>
          <p>Here is what is happening with your teaching work today.</p>
        </div>
        <div className="teacher-dashboard-header-actions">
          <Link to="/teacher/bookings"><Button className="button-secondary"><BookOpen size={17} />Booking requests</Button></Link>
          <Link to="/teacher/slots"><Button><CalendarDays size={17} />Manage slots</Button></Link>
        </div>
      </header>

      {data.applicationStatus !== 'approved' && (
        <Card className={`teacher-dashboard-approval ${data.applicationStatus}`}>
          <div>
            <Badge tone={statusTone}>{data.applicationStatus}</Badge>
            <h3>
              {data.applicationStatus === 'rejected'
                ? 'Your application needs changes'
                : data.applicationStatus === 'pending'
                  ? 'Your application is being reviewed'
                  : 'Complete your teacher application'}
            </h3>
            <p>
              {data.applicationStatus === 'rejected'
                ? data.profile.rejectionReason ?? 'Review the admin feedback and submit your profile again.'
                : data.applicationStatus === 'pending'
                  ? 'You can prepare your slots and teaching content while the admin reviews your application.'
                  : 'Add your professional details, subjects and qualification documents to become visible to students.'}
            </p>
          </div>
          <Link to="/teacher/profile"><Button className="button-secondary">Open profile <ArrowRight size={16} /></Button></Link>
        </Card>
      )}

      <section className="teacher-dashboard-stat-grid teacher-dashboard-stat-grid-five">
        <StatCard label="Today's sessions" value={data.summary.todaySessions} icon={<CalendarDays />} />
        <StatCard label="Published slots today" value={todayOpenAvailability.length} icon={<CalendarClock />} />
        <StatCard label="Pending requests" value={data.summary.pendingRequests} icon={<BookOpen />} />
        <StatCard label="Active students" value={data.summary.activeStudents} icon={<UsersRound />} />
        <StatCard label="Total earnings" value={formatCurrency(data.summary.totalEarnings)} icon={<IndianRupee />} />
      </section>

      <section className="teacher-dashboard-focus-grid teacher-dashboard-focus-grid-session-slots">
        <Card className="teacher-dashboard-upcoming-card">
          <div className="teacher-dashboard-card-heading">
            <div>
              <span>Upcoming sessions</span>
              <h2>Today's booked sessions and published slots</h2>
            </div>
            <Link to="/teacher/slots">
              Manage slots <ArrowRight size={15} />
            </Link>
          </div>

          <div className="teacher-dashboard-upcoming-groups">
            <section className="teacher-dashboard-upcoming-group">
              <div className="teacher-dashboard-upcoming-group-heading">
                <div>
                  <strong>Today's booked sessions</strong>
                  <span>Confirmed lessons scheduled for today</span>
                </div>
                <Badge tone="purple">{todayBookedSessions.length}</Badge>
              </div>
              {todayBookedSessions.length ? (
                <div className="teacher-dashboard-session-list">
                  {todayBookedSessions.map((session) => (
                    <SessionRow key={session.id} session={session} />
                  ))}
                </div>
              ) : (
                <div className="teacher-dashboard-inline-empty">
                  <CalendarClock size={20} />
                  <span>No booked sessions today.</span>
                </div>
              )}
            </section>

            <section className="teacher-dashboard-upcoming-group teacher-dashboard-published-group">
              <div className="teacher-dashboard-upcoming-group-heading">
                <div>
                  <strong>Today's published slots</strong>
                  <span>Open times students can still book today</span>
                </div>
                <Badge tone="success">{todayOpenAvailability.length}</Badge>
              </div>
              {todayOpenAvailability.length ? (
                <div className="teacher-dashboard-availability-list">
                  {todayOpenAvailability.map((slot) => (
                    <AvailabilityRow key={slot.id} slot={slot} />
                  ))}
                </div>
              ) : (
                <div className="teacher-dashboard-inline-empty">
                  <CalendarDays size={20} />
                  <span>No open slots published for today.</span>
                  <Link to="/teacher/slots">Publish a slot</Link>
                </div>
              )}
            </section>
          </div>
        </Card>

        <div className="teacher-dashboard-focus-side">
          <Card className="teacher-dashboard-quick-actions">
            <div className="teacher-dashboard-card-heading">
              <div>
                <span>Quick actions</span>
                <h2>Manage your teaching work</h2>
              </div>
              <Sparkles size={22} />
            </div>
            <div className="teacher-dashboard-action-grid">
              <Link to="/teacher/slots"><CalendarDays size={20} /><span><strong>Manage slots</strong><small>{data.summary.availableSlots} available</small></span><ArrowRight size={16} /></Link>
              <Link to="/teacher/bookings"><BookOpen size={20} /><span><strong>Booking requests</strong><small>{data.summary.pendingRequests} waiting</small></span><ArrowRight size={16} /></Link>
              <Link to="/teacher/doubts"><MessageCircleQuestion size={20} /><span><strong>Student doubts</strong><small>{data.popularDoubts.length} priority topics</small></span><ArrowRight size={16} /></Link>
            </div>
          </Card>
        </div>
      </section>

      <section className="teacher-dashboard-main-grid">
        <div className="teacher-dashboard-main-column">
          <Card className="teacher-dashboard-completed-card">
            <div className="teacher-dashboard-card-heading">
              <div>
                <span>Session history</span>
                <h2>Completed teaching sessions</h2>
              </div>
              <CheckCircle2 size={24} />
            </div>
            <div className="teacher-dashboard-completed-summary">
              <div className="teacher-dashboard-completed-icon">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <strong>{data.summary.completedSessions}</strong>
                <span>lesson{data.summary.completedSessions === 1 ? '' : 's'} completed</span>
                <p>Review past lessons, student feedback, receipts and session notes.</p>
              </div>
              <Link to="/teacher/sessions">
                <Button className="button-secondary">
                  Open session history <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
          </Card>

          <Card>
            <div className="teacher-dashboard-card-heading">
              <div>
                <span>Student demand</span>
                <h2>Popular doubts to prepare</h2>
              </div>
              <Link to="/teacher/doubts">View all doubts <ArrowRight size={15} /></Link>
            </div>
            {data.popularDoubts.length ? (
              <div className="teacher-dashboard-doubt-list">
                {data.popularDoubts.map((poll) => (
                  <Link to="/teacher/doubts" className="teacher-dashboard-doubt" key={poll.id}>
                    <div>
                      <div className="teacher-dashboard-doubt-tags">
                        <Badge tone="neutral">Grade {poll.gradeLevel}</Badge>
                        <Badge tone={poll.status === 'will_cover' ? 'purple' : 'warning'}>{poll.status.replace('_', ' ')}</Badge>
                      </div>
                      <strong>{poll.title}</strong>
                      <p>{poll.subjectName} · {poll.topicName}</p>
                    </div>
                    <div className="teacher-dashboard-doubt-impact">
                      <span><UsersRound size={15} />{poll.voteCount}</span>
                      <span><MessageCircleQuestion size={15} />{poll.commentCount}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<MessageCircleQuestion size={28} />}
                title="No student doubts yet"
                description="Highly voted doubts from the subjects you teach will appear here."
              />
            )}
          </Card>

          <Card className="teacher-dashboard-feedback-card">
            <div className="teacher-dashboard-card-heading">
              <div>
                <span>Recent feedback</span>
                <h2>What students say</h2>
              </div>
              <Star size={22} />
            </div>
            {data.recentReviews.length ? (
              <div className="teacher-dashboard-review-list">
                {data.recentReviews.map((review) => (
                  <article key={review.id}>
                    <div><strong>{review.studentName}</strong><span><Star size={13} />{review.rating.toFixed(1)}</span></div>
                    <p>{review.review}</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Star size={27} />}
                title="No reviews yet"
                description="Student feedback will appear after completed sessions."
              />
            )}
          </Card>
        </div>

        <aside className="teacher-dashboard-side-column">
          <Card className="teacher-dashboard-earnings-card">
            <div className="teacher-dashboard-card-heading">
              <div>
                <span>Earnings overview</span>
                <h2>{formatCurrency(data.summary.thisMonthEarnings)}</h2>
              </div>
              <span className={`teacher-dashboard-trend ${data.summary.earningsChangePercent < 0 ? 'negative' : ''}`}>
                <TrendingUp size={15} />{data.summary.earningsChangePercent}%
              </span>
            </div>
            <p className="muted">Earned this month</p>
            <div className="teacher-dashboard-bars" aria-label="Weekly earnings">
              {data.weeklyEarnings.map((item) => (
                <div key={item.date} title={`${item.label}: ${formatCurrency(item.amount)}`}>
                  <span style={{ height: `${Math.max(8, (item.amount / maxWeeklyEarning) * 100)}%` }} />
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
            <div className="teacher-dashboard-money-grid">
              <div><span>Total earned</span><strong>{formatCurrency(data.summary.totalEarnings)}</strong></div>
              <div><span>Pending payout</span><strong>{formatCurrency(data.summary.pendingPayout)}</strong></div>
            </div>
            <Link to="/teacher/earnings" className="teacher-dashboard-text-link">View earnings <ArrowRight size={15} /></Link>
          </Card>

          <Card>
            <div className="teacher-dashboard-card-heading">
              <div>
                <span>Teaching performance</span>
                <h2>Your impact</h2>
              </div>
              <Star size={22} />
            </div>
            <div className="teacher-dashboard-performance-grid">
              <div><Star size={18} /><span>Rating</span><strong>{data.summary.rating.toFixed(1)}</strong><small>{data.summary.totalReviews} reviews</small></div>
              <div><CheckCircle2 size={18} /><span>Completed</span><strong>{data.summary.completedSessions}</strong><small>sessions</small></div>
              <div><CalendarDays size={18} /><span>Open slots</span><strong>{data.summary.availableSlots}</strong><small>next 30 days</small></div>
              <div><Clock3 size={18} /><span>Response</span><strong>{data.profile.averageResponseTimeMinutes || '—'}</strong><small>{data.profile.averageResponseTimeMinutes ? 'minutes' : 'not measured'}</small></div>
            </div>
          </Card>

          <Card className="teacher-dashboard-readiness">
            <div className="teacher-dashboard-card-heading">
              <div>
                <span>Profile readiness</span>
                <h2>{data.profile.profileCompletedPercent}% complete</h2>
              </div>
              <CircleDollarSign size={22} />
            </div>
            <div className="progress"><span style={{ width: `${data.profile.profileCompletedPercent}%` }} /></div>
            <p>Your public profile currently lists {data.profile.subjects.length} teaching subject{data.profile.subjects.length === 1 ? '' : 's'}.</p>
            <Link to="/teacher/profile" className="teacher-dashboard-text-link">Update profile <ArrowRight size={15} /></Link>
          </Card>
        </aside>
      </section>

    </div>
  )
}
