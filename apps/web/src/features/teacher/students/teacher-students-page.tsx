import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Flame,
  GraduationCap,
  IndianRupee,
  Mail,
  MessageCircleQuestion,
  NotebookPen,
  Phone,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'

import { Badge, Button, Card, Input, StatCard } from '../../../components/ui'
import { api } from '../../../lib/api'
import type {
  TeacherStudentDetails,
  TeacherStudentEngagement,
  TeacherStudentListData,
  TeacherStudentListItem,
} from './types'
import './teacher-students.css'

const STATUS_FILTERS: Array<{
  value: 'all' | TeacherStudentEngagement
  label: string
}> = [
  { value: 'all', label: 'All students' },
  { value: 'upcoming', label: 'Upcoming lesson' },
  { value: 'completed', label: 'Taught before' },
  { value: 'inactive', label: 'No active lesson' },
]

function errorMessage(error: unknown) {
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

function formatDate(value: string | null, timeZone = 'Asia/Kolkata') {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value))
}

function engagementLabel(value: TeacherStudentEngagement) {
  if (value === 'upcoming') return 'Upcoming lesson'
  if (value === 'completed') return 'Previously taught'
  return 'Inactive'
}

function engagementTone(value: TeacherStudentEngagement) {
  if (value === 'upcoming') return 'success' as const
  if (value === 'completed') return 'purple' as const
  return 'neutral' as const
}

export function TeacherStudentsPage() {
  const queryClient = useQueryClient()
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | TeacherStudentEngagement>('all')
  const [grade, setGrade] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [tagDraft, setTagDraft] = useState('')

  const listQuery = useQuery({
    queryKey: ['teacher-students', search, status, grade, subjectId, page],
    queryFn: () =>
      api
        .get('/teacher-students', {
          params: {
            search: search || undefined,
            status,
            grade: grade || undefined,
            subjectId: subjectId || undefined,
            page,
            limit: 10,
          },
        })
        .then((response) => response.data.data as TeacherStudentListData),
    refetchOnWindowFocus: true,
  })

  const detailsQuery = useQuery({
    queryKey: ['teacher-student-details', selectedId],
    queryFn: () =>
      api
        .get(`/teacher-students/${selectedId}`)
        .then((response) => response.data.data as TeacherStudentDetails),
    enabled: Boolean(selectedId),
  })

  useEffect(() => {
    if (!detailsQuery.data) return
    setNoteDraft(detailsQuery.data.privateNote.text)
    setTagDraft(detailsQuery.data.privateNote.tags.join(', '))
  }, [detailsQuery.data])

  const noteMutation = useMutation({
    mutationFn: ({
      studentId,
      note,
      tags,
    }: {
      studentId: string
      note: string
      tags: string[]
    }) => api.patch(`/teacher-students/${studentId}/note`, { note, tags }),
    onSuccess: async () => {
      setNotice('Private teaching note saved.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher-students'] }),
        queryClient.invalidateQueries({
          queryKey: ['teacher-student-details', selectedId],
        }),
      ])
    },
    onError: (error) => setNotice(errorMessage(error)),
  })

  const selectedItem = useMemo(
    () => listQuery.data?.items.find((item) => item.id === selectedId) ?? null,
    [listQuery.data?.items, selectedId],
  )

  function applySearch(event: FormEvent) {
    event.preventDefault()
    setPage(1)
    setSearch(searchDraft.trim())
  }

  if (listQuery.isLoading) return <StudentsSkeleton />

  if (listQuery.isError || !listQuery.data) {
    return (
      <div className="teacher-students-page">
        <Card className="teacher-students-state">
          <AlertCircle size={38} />
          <h2>Could not load your students</h2>
          <p>{errorMessage(listQuery.error)}</p>
          <Button onClick={() => listQuery.refetch()}>Try again</Button>
        </Card>
      </div>
    )
  }

  const data = listQuery.data

  return (
    <div className="teacher-students-page">
      <header className="teacher-students-header">
        <div>
          <p>Teacher · Learner insights</p>
          <h1>Student progress</h1>
          <span>
            Review every learner you teach, their practice performance,
            sessions, doubts and your private notes.
          </span>
        </div>
        <div className="teacher-students-header-actions">
          <Button
            className="button-secondary"
            onClick={() => window.location.assign('/teacher/sessions')}
          >
            <CalendarClock size={17} /> Teaching sessions
          </Button>
          <Button onClick={() => window.location.assign('/teacher/doubts')}>
            <MessageCircleQuestion size={17} /> Student doubts
          </Button>
        </div>
      </header>

      {notice ? (
        <div className="teacher-students-notice">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button aria-label="Dismiss" onClick={() => setNotice(null)}>
            <X size={16} />
          </button>
        </div>
      ) : null}

      <section className="teacher-students-summary">
        <StatCard
          label="Total students"
          value={data.summary.totalStudents}
          icon={<UsersRound size={21} />}
          detail="Learners with a booking history"
        />
        <StatCard
          label="Active learners"
          value={data.summary.activeStudents}
          icon={<UserRound size={21} />}
          detail="Students with an upcoming lesson"
        />
        <StatCard
          label="Upcoming lessons"
          value={data.summary.upcomingLessons}
          icon={<CalendarClock size={21} />}
          detail="Confirmed future sessions"
        />
        <StatCard
          label="Completed lessons"
          value={data.summary.completedLessons}
          icon={<BookOpen size={21} />}
          detail="Lessons delivered"
        />
        <StatCard
          label="Practice average"
          value={`${data.summary.averagePracticeScore}%`}
          icon={<Target size={21} />}
          detail="Across visible learners"
        />
      </section>

      <Card className="teacher-students-filters">
        <form onSubmit={applySearch} className="teacher-students-search">
          <Search size={18} />
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search student, email, standard or subject"
          />
          <Button type="submit">Search</Button>
        </form>

        <div className="teacher-students-filter-row">
          <div className="teacher-students-filter-tabs">
            {STATUS_FILTERS.map((option) => (
              <button
                key={option.value}
                className={status === option.value ? 'active' : ''}
                onClick={() => {
                  setStatus(option.value)
                  setPage(1)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label>
            Standard
            <select
              value={grade}
              onChange={(event) => {
                setGrade(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All standards</option>
              {data.filters.grades.map((value) => (
                <option key={value} value={value}>
                  Standard {value}
                </option>
              ))}
            </select>
          </label>

          <label>
            Subject
            <select
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All subjects</option>
              {data.filters.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {data.items.length ? (
        <section className="teacher-students-grid">
          {data.items.map((item) => (
            <StudentCard
              key={item.id}
              item={item}
              onView={() => setSelectedId(item.id)}
            />
          ))}
        </section>
      ) : (
        <Card className="teacher-students-state">
          <UsersRound size={38} />
          <h2>No matching students</h2>
          <p>
            Students will appear after they book or complete a lesson with you.
          </p>
          <Button onClick={() => window.location.assign('/teacher/bookings')}>
            View booking requests
          </Button>
        </Card>
      )}

      <div className="teacher-students-pagination">
        <Button
          className="button-secondary"
          disabled={page <= 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          <ArrowLeft size={16} /> Previous
        </Button>
        <span>
          Page {data.pagination.page} of {data.pagination.pages}
        </span>
        <Button
          className="button-secondary"
          disabled={page >= data.pagination.pages}
          onClick={() => setPage((value) => value + 1)}
        >
          Next <ArrowRight size={16} />
        </Button>
      </div>

      {selectedId ? (
        <StudentDetailsDrawer
          item={selectedItem}
          details={detailsQuery.data ?? null}
          loading={detailsQuery.isLoading}
          error={detailsQuery.isError ? errorMessage(detailsQuery.error) : null}
          noteDraft={noteDraft}
          tagDraft={tagDraft}
          saving={noteMutation.isPending}
          onNoteChange={setNoteDraft}
          onTagChange={setTagDraft}
          onSave={() =>
            noteMutation.mutate({
              studentId: selectedId,
              note: noteDraft,
              tags: tagDraft
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean)
                .slice(0, 6),
            })
          }
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  )
}

function StudentCard({
  item,
  onView,
}: {
  item: TeacherStudentListItem
  onView: () => void
}) {
  return (
    <Card className="teacher-student-card">
      <div className="teacher-student-card-header">
        <div className="teacher-student-identity">
          <div className="teacher-student-avatar">
            {item.avatar ? <img src={item.avatar} alt="" /> : initials(item.name)}
          </div>
          <div>
            <h2>{item.name}</h2>
            <p>{item.email}</p>
          </div>
        </div>
        <Badge tone={engagementTone(item.engagement)}>
          {engagementLabel(item.engagement)}
        </Badge>
      </div>

      <div className="teacher-student-meta">
        <span>
          <GraduationCap size={15} /> Standard {item.grade ?? 'Not set'}
        </span>
        {item.phone ? (
          <span>
            <Phone size={15} /> {item.phone}
          </span>
        ) : null}
      </div>

      <div className="teacher-student-subjects">
        {item.subjects.map((subject) => (
          <Badge key={subject.id} tone="warning">
            {subject.name}
          </Badge>
        ))}
      </div>

      <div className="teacher-student-card-stats">
        <div>
          <strong>{item.sessions.upcoming}</strong>
          <span>Upcoming</span>
        </div>
        <div>
          <strong>{item.sessions.completed}</strong>
          <span>Completed</span>
        </div>
        <div>
          <strong>{item.practice.averageScore}%</strong>
          <span>Practice avg.</span>
        </div>
      </div>

      <div className="teacher-student-session-row">
        <CalendarClock size={18} />
        <div>
          <span>{item.sessions.nextAt ? 'Next lesson' : 'Last lesson'}</span>
          <strong>
            {formatDate(item.sessions.nextAt ?? item.sessions.lastAt)}
          </strong>
        </div>
      </div>

      <div className="teacher-student-focus">
        <span>Learning focus</span>
        {item.weakTopics.length ? (
          <div>
            {item.weakTopics.map((topic) => (
              <Badge key={topic.name} tone={topic.mastery < 40 ? 'danger' : 'warning'}>
                {topic.name} · {topic.mastery}%
              </Badge>
            ))}
          </div>
        ) : (
          <p>More practice data is needed to identify weak topics.</p>
        )}
      </div>

      {item.note.text ? (
        <div className="teacher-student-note-preview">
          <NotebookPen size={16} />
          <span>{item.note.text}</span>
        </div>
      ) : null}

      <div className="teacher-student-card-actions">
        <Button className="button-secondary" onClick={onView}>
          View progress <ChevronRight size={17} />
        </Button>
        <Button onClick={() => window.location.assign('/teacher/sessions')}>
          Open sessions
        </Button>
      </div>
    </Card>
  )
}

function StudentDetailsDrawer({
  item,
  details,
  loading,
  error,
  noteDraft,
  tagDraft,
  saving,
  onNoteChange,
  onTagChange,
  onSave,
  onClose,
}: {
  item: TeacherStudentListItem | null
  details: TeacherStudentDetails | null
  loading: boolean
  error: string | null
  noteDraft: string
  tagDraft: string
  saving: boolean
  onNoteChange: (value: string) => void
  onTagChange: (value: string) => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <div className="teacher-student-drawer-backdrop" onMouseDown={onClose}>
      <aside
        className="teacher-student-drawer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="teacher-student-drawer-close" onClick={onClose}>
          <X size={20} />
        </button>

        {loading ? (
          <div className="teacher-student-drawer-loading">
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        ) : error ? (
          <div className="teacher-students-state">
            <AlertCircle size={34} />
            <h2>Could not load student details</h2>
            <p>{error}</p>
          </div>
        ) : details ? (
          <>
            <header className="teacher-student-drawer-header">
              <div className="teacher-student-avatar large">
                {details.student.avatar ? (
                  <img src={details.student.avatar} alt="" />
                ) : (
                  initials(details.student.name)
                )}
              </div>
              <div>
                <p>Student progress profile</p>
                <h2>{details.student.name}</h2>
                <span>
                  Standard {details.student.grade ?? 'Not set'} ·{' '}
                  {details.student.email}
                </span>
              </div>
            </header>

            <section className="teacher-student-detail-stats">
              <div>
                <TrendingUp size={18} />
                <span>Average score</span>
                <strong>{details.progress.averageScore}%</strong>
              </div>
              <div>
                <Target size={18} />
                <span>Accuracy</span>
                <strong>{details.progress.accuracy}%</strong>
              </div>
              <div>
                <Flame size={18} />
                <span>Streak</span>
                <strong>{details.progress.streak} days</strong>
              </div>
              <div>
                <Sparkles size={18} />
                <span>XP / Level</span>
                <strong>
                  {details.progress.xp} / L{details.progress.level}
                </strong>
              </div>
            </section>

            <section className="teacher-student-detail-section">
              <div className="teacher-student-detail-heading">
                <div>
                  <span>Mastery</span>
                  <h3>Topic performance</h3>
                </div>
                <Target size={20} />
              </div>
              {details.progress.topicMastery.length ? (
                <div className="teacher-student-mastery-list">
                  {details.progress.topicMastery.map((topic) => (
                    <div key={topic.id}>
                      <div>
                        <strong>{topic.name}</strong>
                        <span>
                          {topic.attempts} attempts · {topic.mastery}%
                        </span>
                      </div>
                      <div className="teacher-student-progress-bar">
                        <span style={{ width: `${topic.mastery}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="teacher-student-empty-copy">
                  No topic mastery data is available yet.
                </p>
              )}
            </section>

            <section className="teacher-student-detail-section">
              <div className="teacher-student-detail-heading">
                <div>
                  <span>Teaching history</span>
                  <h3>Sessions with you</h3>
                </div>
                <CalendarClock size={20} />
              </div>
              <div className="teacher-student-session-summary">
                <div>
                  <strong>{details.sessionSummary.upcoming}</strong>
                  <span>Upcoming</span>
                </div>
                <div>
                  <strong>{details.sessionSummary.completed}</strong>
                  <span>Completed</span>
                </div>
                <div>
                  <strong>₹{details.sessionSummary.totalPaid}</strong>
                  <span>Total paid</span>
                </div>
              </div>
              <div className="teacher-student-history-list">
                {details.sessions.slice(0, 6).map((session) => (
                  <article key={session.id}>
                    <div>
                      <strong>
                        {session.subject} · {session.chapter}
                      </strong>
                      <span>{formatDate(session.scheduledAt, session.timezone)}</span>
                    </div>
                    <Badge
                      tone={
                        session.status === 'completed'
                          ? 'success'
                          : session.status === 'cancelled' ||
                              session.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {session.status}
                    </Badge>
                  </article>
                ))}
              </div>
            </section>

            <section className="teacher-student-detail-section">
              <div className="teacher-student-detail-heading">
                <div>
                  <span>Student questions</span>
                  <h3>Doubts and learning needs</h3>
                </div>
                <MessageCircleQuestion size={20} />
              </div>
              {details.doubts.length ? (
                <div className="teacher-student-doubt-list">
                  {details.doubts.slice(0, 5).map((doubt) => (
                    <article key={doubt.id}>
                      <div>
                        <strong>{doubt.title}</strong>
                        <span>
                          {doubt.subject} · {doubt.chapter}
                        </span>
                      </div>
                      <Badge tone={doubt.status === 'resolved' ? 'success' : 'purple'}>
                        {doubt.votes} students
                      </Badge>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="teacher-student-empty-copy">
                  No linked doubt polls are available.
                </p>
              )}
            </section>

            <section className="teacher-student-detail-section">
              <div className="teacher-student-detail-heading">
                <div>
                  <span>Private workspace</span>
                  <h3>Teaching note</h3>
                </div>
                <NotebookPen size={20} />
              </div>
              <label className="teacher-student-note-field">
                Note visible only to you
                <textarea
                  value={noteDraft}
                  onChange={(event) => onNoteChange(event.target.value)}
                  maxLength={2000}
                  placeholder="Record learning needs, preparation reminders or follow-up points."
                />
              </label>
              <label className="teacher-student-note-field">
                Tags, separated by commas
                <Input
                  value={tagDraft}
                  onChange={(event) => onTagChange(event.target.value)}
                  placeholder="Needs revision, exam preparation"
                />
              </label>
              <Button disabled={saving} onClick={onSave}>
                <FileText size={17} />
                {saving ? 'Saving…' : 'Save private note'}
              </Button>
            </section>
          </>
        ) : item ? (
          <div className="teacher-students-state">
            <UserRound size={34} />
            <h2>{item.name}</h2>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

function StudentsSkeleton() {
  return (
    <div className="teacher-students-page">
      <div className="skeleton teacher-students-header-skeleton" />
      <div className="teacher-students-summary">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="skeleton" key={index} />
        ))}
      </div>
      <div className="teacher-students-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="skeleton teacher-student-card-skeleton" key={index} />
        ))}
      </div>
    </div>
  )
}
