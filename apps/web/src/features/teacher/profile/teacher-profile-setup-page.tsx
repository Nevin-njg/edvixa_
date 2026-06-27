import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Award,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  GraduationCap,
  IndianRupee,
  Languages,
  Pencil,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Badge, Button, Card, Input, StatCard } from '../../../components/ui'
import { api } from '../../../lib/api'
import { useAuthStore } from '../../../stores/auth.store'
import type {
  TeacherApplicationStatus,
  TeacherProfileData,
  TeacherProfileDocument,
  TeacherProfileDraft,
} from './types'

const MAX_AVATAR_BYTES = 320 * 1024
const MAX_DOCUMENT_BYTES = 420 * 1024

export function TeacherProfileSetupPage() {
  const queryClient = useQueryClient()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const authUser = useAuthStore((state) => state.user)
  const accessToken = useAuthStore((state) => state.accessToken)
  const setSession = useAuthStore((state) => state.setSession)

  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<TeacherProfileDraft | null>(null)
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error'
    message: string
  } | null>(null)

  const profileQuery = useQuery<TeacherProfileData>({
    queryKey: ['teacher-profile-setup'],
    queryFn: () =>
      api.get('/teachers/profile').then((response) => response.data.data),
  })

  useEffect(() => {
    if (profileQuery.data && !draft) {
      setDraft(toDraft(profileQuery.data))
      if (profileQuery.data.profile.applicationStatus === 'draft') {
        setIsEditing(true)
      }
    }
  }, [draft, profileQuery.data])

  const saveMutation = useMutation({
    mutationFn: (submitForReview: boolean) => {
      if (!draft) throw new Error('Profile form is not ready')
      return api
        .patch('/teachers/profile', toPayload(draft, submitForReview))
        .then((response) => response.data.data as TeacherProfileData)
    },
    onSuccess: async (data, submitForReview) => {
      setDraft(toDraft(data))
      setIsEditing(false)
      setNotice({
        tone: 'success',
        message: submitForReview
          ? 'Your profile was submitted for admin review.'
          : 'Teacher profile saved successfully.',
      })
      if (accessToken && authUser) {
        setSession(accessToken, {
          ...authUser,
          name: data.user.name,
          avatar: data.user.avatar,
        })
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher-profile-setup'] }),
        queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] }),
      ])
    },
    onError: (error) =>
      setNotice({ tone: 'error', message: apiErrorMessage(error) }),
  })

  const selectedSubjects = useMemo(() => {
    if (!profileQuery.data || !draft) return []
    const selected = new Set(draft.subjects)
    return profileQuery.data.availableSubjects.filter((subject) =>
      selected.has(subject.id),
    )
  }, [draft, profileQuery.data])

  function cancelEditing() {
    if (!profileQuery.data) return
    setDraft(toDraft(profileQuery.data))
    setIsEditing(false)
    setNotice(null)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    saveMutation.mutate(false)
  }

  function submitForReview() {
    setNotice(null)
    saveMutation.mutate(true)
  }

  function toggleListField(
    field: 'subjects' | 'gradeLevels' | 'languages',
    value: string,
  ) {
    if (!draft) return
    const values = draft[field]
    setDraft({
      ...draft,
      [field]: values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    })
  }

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !draft) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setNotice({ tone: 'error', message: 'Choose a PNG, JPEG, or WebP image.' })
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setNotice({ tone: 'error', message: 'Profile image must be under 320 KB.' })
      return
    }
    readFile(file, (fileUrl) => {
      setDraft({ ...draft, avatar: fileUrl })
      setNotice(null)
    })
  }

  function chooseDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !draft) return
    if (draft.documents.length >= 2) {
      setNotice({ tone: 'error', message: 'You can upload up to two documents.' })
      return
    }
    if (
      ![
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
      ].includes(file.type)
    ) {
      setNotice({
        tone: 'error',
        message: 'Choose a PDF, PNG, JPEG, or WebP document.',
      })
      return
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setNotice({ tone: 'error', message: 'Each document must be under 420 KB.' })
      return
    }
    readFile(file, (fileUrl) => {
      const document: TeacherProfileDocument = {
        title: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
        fileUrl,
        fileType: file.type,
        status: 'pending',
      }
      setDraft({ ...draft, documents: [...draft.documents, document] })
      setNotice(null)
    })
  }

  if (profileQuery.isLoading) return <TeacherProfileSkeleton />

  if (profileQuery.isError || !profileQuery.data || !draft) {
    return (
      <div className="teacher-profile-page">
        <TeacherProfileHeader />
        <Card className="teacher-profile-error">
          <AlertCircle size={40} />
          <div>
            <h3>We could not load your teacher profile</h3>
            <p className="muted">Check the API and MongoDB, then try again.</p>
          </div>
          <Button onClick={() => profileQuery.refetch()} type="button">
            Try again
          </Button>
        </Card>
      </div>
    )
  }

  const data = profileQuery.data
  const draftReadiness = calculateDraftReadiness(draft)
  const canSubmit =
    draftReadiness >= 80 &&
    draft.documents.length > 0 &&
    draft.subjects.length > 0 &&
    draft.gradeLevels.length > 0
  const isApproved = data.profile.applicationStatus === 'approved'
  const isPending = data.profile.applicationStatus === 'pending'

  return (
    <div className="teacher-profile-page">
      <TeacherProfileHeader
        status={data.profile.applicationStatus}
        action={
          isEditing ? (
            <div className="button-row teacher-profile-actions">
              <Button
                className="button-secondary"
                disabled={saveMutation.isPending}
                onClick={cancelEditing}
                type="button"
              >
                <X size={17} /> Cancel
              </Button>
              <Button
                disabled={saveMutation.isPending}
                form="teacher-profile-form"
                type="submit"
              >
                <Save size={17} />
                {saveMutation.isPending ? 'Saving…' : 'Save profile'}
              </Button>
            </div>
          ) : (
            <Button onClick={() => setIsEditing(true)} type="button">
              <Pencil size={17} /> Edit profile
            </Button>
          )
        }
      />

      {notice ? (
        <div className={`teacher-profile-notice ${notice.tone}`} role="status">
          {notice.tone === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          {notice.message}
        </div>
      ) : null}

      <ApplicationBanner
        completion={data.profile.profileCompletedPercent}
        rejectionReason={data.profile.rejectionReason}
        status={data.profile.applicationStatus}
      />

      <Card className="teacher-profile-hero">
        <div className="teacher-profile-avatar-area">
          <Avatar avatar={draft.avatar || null} name={draft.name} />
          {isEditing ? (
            <>
              <input
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={chooseAvatar}
                ref={avatarInputRef}
                type="file"
              />
              <Button
                className="button-secondary teacher-profile-compact-button"
                onClick={() => avatarInputRef.current?.click()}
                type="button"
              >
                <Upload size={15} /> Upload photo
              </Button>
            </>
          ) : null}
        </div>

        <div className="teacher-profile-identity">
          <div className="teacher-profile-badges">
            <StatusBadge status={data.profile.applicationStatus} />
            <Badge tone={data.user.isEmailVerified ? 'success' : 'warning'}>
              {data.user.isEmailVerified ? 'Account email verified' : 'Account email unverified'}
            </Badge>
          </div>
          <h2>{data.user.name}</h2>
          <p className="muted">{data.user.email}</p>
          <div className="teacher-profile-completion">
            <div className="row-between">
              <strong>Profile completion</strong>
              <span>{data.profile.profileCompletedPercent}%</span>
            </div>
            <div className="progress">
              <span
                style={{ width: `${data.profile.profileCompletedPercent}%` }}
              />
            </div>
            <p className="muted">
              {isApproved
                ? data.profile.profileCompletedPercent >= 100
                  ? 'Your verified profile is complete and visible to students.'
                  : 'Your profile is verified and active. Add optional details to reach 100%.'
                : 'Complete at least 80% and upload a qualification document before submitting.'}
            </p>
          </div>
        </div>

        <div className="teacher-profile-hero-stats">
          <div><span>Subjects</span><strong>{selectedSubjects.length}</strong></div>
          <div><span>Hourly rate</span><strong>₹{draft.hourlyRate || 0}</strong></div>
          <div><span>Experience</span><strong>{draft.experienceYears || 0} years</strong></div>
        </div>
      </Card>

      <div className="stat-grid teacher-profile-stat-grid">
        <StatCard
          detail={`${data.profile.totalReviews} reviews`}
          icon={<Sparkles />}
          label="Rating"
          value={data.profile.rating.toFixed(1)}
        />
        <StatCard
          detail="Lessons delivered"
          icon={<BookOpen />}
          label="Completed sessions"
          value={data.profile.totalSessionsCompleted}
        />
        <StatCard
          detail="Unique learners"
          icon={<UsersRound />}
          label="Students taught"
          value={data.profile.totalStudentsTaught}
        />
        <StatCard
          detail={data.profile.applicationStatus === 'approved' ? 'Public profile active' : 'Admin approval required'}
          icon={<ShieldCheck />}
          label="Application"
          value={statusLabel(data.profile.applicationStatus)}
        />
      </div>

      <form id="teacher-profile-form" onSubmit={submit}>
        <div className="teacher-profile-grid">
          <Card>
            <SectionHeading
              description="Account and contact information"
              icon={<UserRound size={21} />}
              title="Personal details"
            />
            <div className="teacher-profile-form-grid">
              <Field label="Full name">
                {isEditing ? (
                  <Input
                    maxLength={80}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                    required
                    value={draft.name}
                  />
                ) : (
                  <ReadValue value={data.user.name} />
                )}
              </Field>
              <Field label="Email address">
                <ReadValue value={data.user.email} />
              </Field>
              <Field label="Phone number">
                {isEditing ? (
                  <Input
                    maxLength={30}
                    onChange={(event) =>
                      setDraft({ ...draft, phone: event.target.value })
                    }
                    placeholder="Add your phone number"
                    value={draft.phone}
                  />
                ) : (
                  <ReadValue value={data.user.phone || 'Not added'} />
                )}
              </Field>
              <Field label="Timezone">
                {isEditing ? (
                  <select
                    className="input teacher-profile-select"
                    onChange={(event) =>
                      setDraft({ ...draft, timezone: event.target.value })
                    }
                    value={draft.timezone}
                  >
                    {data.options.timezones.map((timezone) => (
                      <option key={timezone} value={timezone}>{timezone}</option>
                    ))}
                  </select>
                ) : (
                  <ReadValue value={data.profile.timezone} />
                )}
              </Field>
            </div>
          </Card>

          <Card>
            <SectionHeading
              description="Your qualifications and pricing"
              icon={<Award size={21} />}
              title="Professional information"
            />
            <Field label="Highest qualification">
              {isEditing ? (
                <Input
                  maxLength={250}
                  onChange={(event) =>
                    setDraft({ ...draft, qualification: event.target.value })
                  }
                  placeholder="Example: M.Sc. Physics, B.Ed."
                  value={draft.qualification}
                />
              ) : (
                <ReadValue value={data.profile.qualification || 'Not added'} />
              )}
            </Field>
            <div className="teacher-profile-form-grid teacher-profile-number-grid">
              <Field label="Experience (years)">
                {isEditing ? (
                  <Input
                    min={0}
                    max={80}
                    onChange={(event) =>
                      setDraft({ ...draft, experienceYears: event.target.value })
                    }
                    type="number"
                    value={draft.experienceYears}
                  />
                ) : (
                  <ReadValue value={`${data.profile.experienceYears} years`} />
                )}
              </Field>
              <Field label="Hourly rate (₹)">
                {isEditing ? (
                  <Input
                    min={0}
                    max={100000}
                    onChange={(event) =>
                      setDraft({ ...draft, hourlyRate: event.target.value })
                    }
                    type="number"
                    value={draft.hourlyRate}
                  />
                ) : (
                  <ReadValue value={`₹${data.profile.hourlyRate}`} />
                )}
              </Field>
            </div>
          </Card>

          <Card className="teacher-profile-wide-card">
            <SectionHeading
              description="Tell students what makes your lessons effective"
              icon={<Sparkles size={21} />}
              title="About your teaching"
            />
            <div className="teacher-profile-two-columns">
              <Field label="Professional bio">
                {isEditing ? (
                  <textarea
                    className="input teacher-profile-textarea"
                    maxLength={1200}
                    onChange={(event) =>
                      setDraft({ ...draft, bio: event.target.value })
                    }
                    placeholder="Introduce your background and expertise."
                    rows={6}
                    value={draft.bio}
                  />
                ) : (
                  <ReadValue value={data.profile.bio || 'Not added'} />
                )}
              </Field>
              <Field label="Teaching approach">
                {isEditing ? (
                  <textarea
                    className="input teacher-profile-textarea"
                    maxLength={1200}
                    onChange={(event) =>
                      setDraft({ ...draft, teachingApproach: event.target.value })
                    }
                    placeholder="Explain how you structure lessons and support students."
                    rows={6}
                    value={draft.teachingApproach}
                  />
                ) : (
                  <ReadValue value={data.profile.teachingApproach || 'Not added'} />
                )}
              </Field>
            </div>
          </Card>

          <Card>
            <SectionHeading
              description="Subjects you are qualified to teach"
              icon={<BookOpen size={21} />}
              title="Subjects"
            />
            <OptionGrid
              editing={isEditing}
              items={data.availableSubjects.map((subject) => ({
                id: subject.id,
                label: subject.name,
              }))}
              selected={draft.subjects}
              toggle={(value) => toggleListField('subjects', value)}
            />
          </Card>

          <Card>
            <SectionHeading
              description="Student standards you accept"
              icon={<GraduationCap size={21} />}
              title="Standards"
            />
            <OptionGrid
              editing={isEditing}
              items={data.options.gradeLevels.map((grade) => ({
                id: grade,
                label: `Grade ${grade}`,
              }))}
              selected={draft.gradeLevels}
              toggle={(value) => toggleListField('gradeLevels', value)}
            />
          </Card>

          <Card>
            <SectionHeading
              description="Languages available during lessons"
              icon={<Languages size={21} />}
              title="Teaching languages"
            />
            <OptionGrid
              editing={isEditing}
              items={data.options.languages.map((language) => ({
                id: language,
                label: language,
              }))}
              selected={draft.languages}
              toggle={(value) => toggleListField('languages', value)}
            />
          </Card>

          <Card>
            <SectionHeading
              description="Upload proof of qualification for admin review"
              icon={<FileCheck2 size={21} />}
              title="Verification documents"
            />
            <input
              accept="application/pdf,image/png,image/jpeg,image/webp"
              hidden
              onChange={chooseDocument}
              ref={documentInputRef}
              type="file"
            />
            {isEditing ? (
              <button
                className="teacher-document-dropzone"
                disabled={draft.documents.length >= 2}
                onClick={() => documentInputRef.current?.click()}
                type="button"
              >
                <Upload size={25} />
                <strong>Upload qualification document</strong>
                <span>PDF, PNG, JPEG or WebP · max 420 KB · up to 2 files</span>
              </button>
            ) : null}
            <DocumentList
              documents={draft.documents}
              editing={isEditing}
              profileApproved={isApproved}
              remove={(index) =>
                setDraft({
                  ...draft,
                  documents: draft.documents.filter((_, itemIndex) => itemIndex !== index),
                })
              }
            />
          </Card>
        </div>
      </form>

      <Card className="teacher-profile-submit-card">
        <div>
          <div className="teacher-profile-submit-title">
            <ShieldCheck size={22} />
            <h3>
              {isApproved
                ? 'Profile verified'
                : isPending
                  ? 'Admin review in progress'
                  : 'Admin verification'}
            </h3>
          </div>
          <p className="muted">
            {isApproved
              ? 'Your profile is active and visible to students. You can continue editing your public teaching information.'
              : isPending
                ? 'Your profile and qualification documents are being reviewed. No further submission is required.'
                : 'Save your profile first, then submit it when your details and documents are ready.'}
          </p>
        </div>
        <div className="teacher-profile-submit-actions">
          <Badge
            tone={
              isApproved || isPending || canSubmit
                ? 'success'
                : 'warning'
            }
          >
            {isApproved
              ? 'Verified'
              : isPending
                ? 'Under review'
                : canSubmit
                  ? 'Ready to submit'
                  : 'Complete requirements to submit'}
          </Badge>
          {!isApproved && !isPending ? (
            <Button
              disabled={!canSubmit || saveMutation.isPending}
              onClick={submitForReview}
              type="button"
            >
              <ShieldCheck size={17} />
              {data.profile.applicationStatus === 'rejected'
                ? 'Resubmit for review'
                : 'Submit for admin review'}
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  )
}

function TeacherProfileHeader({
  action,
  status,
}: {
  action?: React.ReactNode
  status?: TeacherApplicationStatus
}) {
  return (
    <div className="page-header">
      <div>
        <p className="muted">Teacher · Profile and verification</p>
        <h1>My teacher profile</h1>
        <p className="muted">
          {status === 'approved'
            ? 'Manage the public teaching profile students use to discover and book you.'
            : status === 'pending'
              ? 'Review your submitted teaching profile while admin verification is in progress.'
              : 'Complete your public teaching profile and submit it for approval.'}
        </p>
      </div>
      {action}
    </div>
  )
}

function ApplicationBanner({
  completion,
  rejectionReason,
  status,
}: {
  completion: number
  rejectionReason: string | null
  status: TeacherApplicationStatus
}) {
  const content = {
    draft: {
      title: 'Complete your teacher application',
      message: `${completion}% completed. Add your teaching scope and qualification proof before submitting.`,
      tone: 'draft',
    },
    pending: {
      title: 'Your application is under review',
      message: 'The admin team will review your profile and verification documents.',
      tone: 'pending',
    },
    approved: {
      title: 'Your teacher profile is approved',
      message: 'Students can discover your profile and book available lesson slots.',
      tone: 'approved',
    },
    rejected: {
      title: 'Changes are required before approval',
      message: rejectionReason || 'Review your details, update the profile, and submit again.',
      tone: 'rejected',
    },
  }[status]

  return (
    <div className={`teacher-application-banner ${content.tone}`}>
      <ShieldCheck size={22} />
      <div>
        <strong>{content.title}</strong>
        <p>{content.message}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: TeacherApplicationStatus }) {
  const tone =
    status === 'approved'
      ? 'success'
      : status === 'rejected'
        ? 'danger'
        : status === 'pending'
          ? 'warning'
          : 'neutral'
  return <Badge tone={tone}>{statusLabel(status)}</Badge>
}

function statusLabel(status: TeacherApplicationStatus) {
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Changes requested'
  if (status === 'pending') return 'Under review'
  return 'Draft'
}

function Avatar({ avatar, name }: { avatar: string | null; name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'T'
  return (
    <div className="teacher-profile-avatar">
      <span>{initials}</span>
      {avatar ? <img alt={`${name} profile`} src={avatar} /> : null}
      <i><Camera size={15} /></i>
    </div>
  )
}

function SectionHeading({
  description,
  icon,
  title,
}: {
  description: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <div className="teacher-profile-section-heading">
      <span>{icon}</span>
      <div><h3>{title}</h3><p className="muted">{description}</p></div>
    </div>
  )
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="teacher-profile-field"><span>{label}</span>{children}</label>
}

function ReadValue({ value }: { value: string }) {
  return <div className="teacher-profile-read-value">{value}</div>
}

function OptionGrid({
  editing,
  items,
  selected,
  toggle,
}: {
  editing: boolean
  items: Array<{ id: string; label: string }>
  selected: string[]
  toggle: (value: string) => void
}) {
  const selectedItems = items.filter((item) => selected.includes(item.id))
  if (!editing && selectedItems.length === 0) {
    return <div className="teacher-profile-empty">Not added yet.</div>
  }
  return (
    <div className="teacher-profile-option-grid">
      {(editing ? items : selectedItems).map((item) => {
        const active = selected.includes(item.id)
        return (
          <button
            className={`teacher-profile-option ${active ? 'selected' : ''}`}
            disabled={!editing}
            key={item.id}
            onClick={() => toggle(item.id)}
            type="button"
          >
            <span>{active ? <Check size={15} /> : null}</span>
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function DocumentList({
  documents,
  editing,
  profileApproved,
  remove,
}: {
  documents: TeacherProfileDocument[]
  editing: boolean
  profileApproved: boolean
  remove: (index: number) => void
}) {
  if (documents.length === 0) {
    return <div className="teacher-profile-empty">No verification document uploaded.</div>
  }
  return (
    <div className="teacher-document-list">
      {documents.map((document, index) => {
        const effectiveStatus = profileApproved
          ? 'approved'
          : document.status || 'pending'

        return (
        <div className="teacher-document-item" key={`${document.fileUrl.slice(0, 40)}-${index}`}>
          <span className="teacher-document-icon"><FileText size={19} /></span>
          <div><strong>{document.title}</strong><p className="muted">{document.fileType}</p></div>
          <Badge tone={effectiveStatus === 'approved' ? 'success' : effectiveStatus === 'rejected' ? 'danger' : 'warning'}>
            {effectiveStatus}
          </Badge>
          {editing ? (
            <button aria-label={`Remove ${document.title}`} className="teacher-document-remove" onClick={() => remove(index)} type="button">
              <Trash2 size={17} />
            </button>
          ) : null}
        </div>
        )
      })}
    </div>
  )
}

function TeacherProfileSkeleton() {
  return (
    <div className="teacher-profile-page">
      <div className="skeleton teacher-profile-header-skeleton" />
      <div className="skeleton teacher-profile-hero-skeleton" />
      <div className="stat-grid">{[1, 2, 3, 4].map((item) => <div className="skeleton" key={item} />)}</div>
    </div>
  )
}

function toDraft(data: TeacherProfileData): TeacherProfileDraft {
  return {
    name: data.user.name,
    phone: data.user.phone || '',
    avatar: data.user.avatar || '',
    bio: data.profile.bio,
    teachingApproach: data.profile.teachingApproach,
    qualification: data.profile.qualification,
    experienceYears: String(data.profile.experienceYears || ''),
    hourlyRate: String(data.profile.hourlyRate || ''),
    timezone: data.profile.timezone,
    subjects: data.profile.subjects.map((subject) => subject.id),
    gradeLevels: data.profile.gradeLevels,
    languages: data.profile.languages,
    documents: data.profile.documents,
  }
}

function toPayload(draft: TeacherProfileDraft, submitForReview: boolean) {
  return {
    name: draft.name.trim(),
    phone: draft.phone.trim() || null,
    avatar: draft.avatar || null,
    bio: draft.bio.trim(),
    teachingApproach: draft.teachingApproach.trim(),
    qualification: draft.qualification.trim(),
    experienceYears: Number(draft.experienceYears) || 0,
    hourlyRate: Number(draft.hourlyRate) || 0,
    timezone: draft.timezone,
    subjects: draft.subjects,
    gradeLevels: draft.gradeLevels,
    languages: draft.languages,
    documents: draft.documents.map(({ title, fileUrl, fileType }) => ({ title, fileUrl, fileType })),
    submitForReview,
  }
}

function calculateDraftReadiness(draft: TeacherProfileDraft) {
  const checks: Array<[boolean, number]> = [
    [Boolean(draft.name.trim()), 8],
    [Boolean(draft.phone.trim()), 7],
    [Boolean(draft.avatar), 5],
    [Boolean(draft.qualification.trim()), 12],
    [Boolean(draft.bio.trim()), 10],
    [Boolean(draft.teachingApproach.trim()), 10],
    [(Number(draft.experienceYears) || 0) > 0, 8],
    [(Number(draft.hourlyRate) || 0) >= 100, 8],
    [draft.subjects.length > 0, 10],
    [draft.gradeLevels.length > 0, 8],
    [draft.languages.length > 0, 5],
    [draft.documents.length > 0, 9],
  ]
  return checks.reduce((total, [ready, score]) => total + (ready ? score : 0), 0)
}

function readFile(file: File, done: (value: string) => void) {
  const reader = new FileReader()
  reader.onload = () => done(String(reader.result || ''))
  reader.readAsDataURL(file)
}

function apiErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string; error?: { message?: string } } } }).response
    return response?.data?.message || response?.data?.error?.message || 'The request could not be completed.'
  }
  return error instanceof Error ? error.message : 'The request could not be completed.'
}
