import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Download,
  IndianRupee,
  Landmark,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useMemo, useState } from 'react'

import { Badge, Button, Card, Input, StatCard } from '../../../components/ui'
import { api } from '../../../lib/api'
import type {
  EarningsPaymentStatus,
  EarningsPayoutStatus,
  EarningsPeriod,
  TeacherEarningsData,
  TeacherEarningsStatementData,
  TeacherEarningsTransaction,
} from './types'
import './teacher-earnings.css'

const PERIODS: Array<{ value: EarningsPeriod; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
]

const PAYMENT_STATUSES: Array<{
  value: EarningsPaymentStatus
  label: string
}> = [
  { value: 'all', label: 'All payments' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'failed', label: 'Failed' },
]

const PAYOUT_STATUSES: Array<{
  value: EarningsPayoutStatus
  label: string
}> = [
  { value: 'all', label: 'All payouts' },
  { value: 'pending', label: 'Payout pending' },
  { value: 'approved', label: 'Payout approved' },
  { value: 'paid', label: 'Paid out' },
  { value: 'failed', label: 'Payout failed' },
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

function formatMoney(value: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDateTime(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function paymentTone(status: string) {
  if (status === 'paid') return 'success' as const
  if (status === 'failed' || status === 'refunded') return 'danger' as const
  return 'warning' as const
}

function payoutTone(status: string) {
  if (status === 'paid') return 'success' as const
  if (status === 'failed') return 'danger' as const
  if (status === 'approved') return 'purple' as const
  return 'warning' as const
}

function label(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function csvCell(value: string | number | null) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

export function TeacherEarningsPage() {
  const [period, setPeriod] = useState<EarningsPeriod>('30d')
  const [status, setStatus] = useState<EarningsPaymentStatus>('all')
  const [payoutStatus, setPayoutStatus] =
    useState<EarningsPayoutStatus>('all')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error'
    message: string
  } | null>(null)

  const query = useQuery({
    queryKey: [
      'teacher-earnings',
      period,
      status,
      payoutStatus,
      search,
      page,
    ],
    queryFn: () =>
      api
        .get('/teacher-earnings', {
          params: {
            period,
            status,
            payoutStatus,
            search,
            page,
            limit: 10,
          },
        })
        .then((response) => response.data.data as TeacherEarningsData),
    refetchOnWindowFocus: true,
  })

  const chartMax = useMemo(
    () =>
      Math.max(
        1,
        ...(query.data?.chart.map((item) => item.value) ?? [1]),
      ),
    [query.data?.chart],
  )

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchDraft.trim())
  }

  const changePeriod = (value: EarningsPeriod) => {
    setPage(1)
    setPeriod(value)
  }

  const changeStatus = (value: EarningsPaymentStatus) => {
    setPage(1)
    setStatus(value)
  }

  const changePayoutStatus = (value: EarningsPayoutStatus) => {
    setPage(1)
    setPayoutStatus(value)
  }

  const downloadStatement = async () => {
    setExporting(true)
    setNotice(null)

    try {
      const response = await api.get('/teacher-earnings/statement', {
        params: { period, status, payoutStatus, search },
      })
      const data = response.data.data as TeacherEarningsStatementData

      const rows = [
        [
          'Date',
          'Student',
          'Email',
          'Subject',
          'Topic',
          'Payment status',
          'Payout status',
          'Gross amount',
          'Platform deduction',
          'Teacher earning',
          'Currency',
          'Payment method',
          'Gateway payment ID',
        ],
        ...data.transactions.map((transaction) => [
          formatDate(transaction.paidAt ?? transaction.createdAt),
          transaction.student.name,
          transaction.student.email,
          transaction.subject,
          transaction.topicName,
          transaction.paymentStatus,
          transaction.payoutStatus,
          transaction.totalAmount,
          transaction.totalDeduction,
          transaction.teacherEarning,
          transaction.currency,
          transaction.paymentMethod,
          transaction.gatewayPaymentId,
        ]),
      ]

      const csv = rows
        .map((row) => row.map((value) => csvCell(value)).join(','))
        .join('\n')
      const blob = new Blob([`\uFEFF${csv}`], {
        type: 'text/csv;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `edvixa-earnings-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      setNotice({
        tone: 'success',
        message: `Statement downloaded with ${data.transactions.length} transactions.`,
      })
    } catch (error) {
      setNotice({ tone: 'error', message: apiMessage(error) })
    } finally {
      setExporting(false)
    }
  }

  if (query.isLoading) {
    return <TeacherEarningsSkeleton />
  }

  if (query.isError || !query.data) {
    return (
      <div className="teacher-earnings-page">
        <Card className="teacher-earnings-state-card">
          <AlertCircle size={38} />
          <h2>Could not load earnings</h2>
          <p>{apiMessage(query.error)}</p>
          <Button onClick={() => query.refetch()}>
            <RefreshCw size={17} /> Try again
          </Button>
        </Card>
      </div>
    )
  }

  const data = query.data
  const currency = data.summary.currency

  return (
    <div className="teacher-earnings-page">
      <header className="teacher-earnings-header">
        <div>
          <p className="teacher-earnings-eyebrow">Teacher · Finance centre</p>
          <h1>Earnings</h1>
          <p>
            Track completed-session income, deductions, refunds and payout
            progress.
          </p>
        </div>
        <Button
          className="button-secondary"
          onClick={downloadStatement}
          disabled={exporting}
        >
          <Download size={17} />
          {exporting ? 'Preparing…' : 'Download statement'}
        </Button>
      </header>

      {notice ? (
        <div className={`teacher-earnings-notice ${notice.tone}`}>
          {notice.tone === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      ) : null}

      <section className="teacher-earnings-stat-grid">
        <StatCard
          label="Total earnings"
          value={formatMoney(data.summary.totalEarnings, currency)}
          icon={<IndianRupee size={21} />}
          detail={`${data.summary.paidTransactions} paid transactions`}
        />
        <StatCard
          label="This month"
          value={formatMoney(data.summary.thisMonthEarnings, currency)}
          icon={<TrendingUp size={21} />}
          detail="Teacher net income"
        />
        <StatCard
          label="Pending payout"
          value={formatMoney(data.summary.pendingPayout, currency)}
          icon={<WalletCards size={21} />}
          detail="Pending or approved transfer"
        />
        <StatCard
          label="Completed-session income"
          value={formatMoney(
            data.summary.completedSessionIncome,
            currency,
          )}
          icon={<CalendarDays size={21} />}
          detail={`${data.summary.completedSessions} completed sessions`}
        />
        <StatCard
          label="Platform deductions"
          value={formatMoney(
            data.summary.platformDeductions,
            currency,
          )}
          icon={<ReceiptText size={21} />}
          detail="Fee and commission"
        />
      </section>

      <section className="teacher-earnings-overview-grid">
        <Card className="teacher-earnings-chart-card">
          <div className="teacher-earnings-card-heading">
            <div>
              <span>Income trend</span>
              <h2>Last six months</h2>
            </div>
            <Badge tone="purple">Net earnings</Badge>
          </div>

          <div className="teacher-earnings-chart">
            {data.chart.map((item) => {
              const height =
                item.value === 0 ? 4 : Math.max(12, (item.value / chartMax) * 100)

              return (
                <div className="teacher-earnings-chart-column" key={item.key}>
                  <div className="teacher-earnings-chart-value">
                    {formatMoney(item.value, currency)}
                  </div>
                  <div className="teacher-earnings-chart-track">
                    <span style={{ height: `${height}%` }} />
                  </div>
                  <strong>{item.label}</strong>
                </div>
              )
            })}
          </div>
        </Card>

        <Card className="teacher-earnings-payout-card">
          <div className="teacher-earnings-card-heading">
            <div>
              <span>Payout overview</span>
              <h2>Teacher settlement</h2>
            </div>
            <Landmark size={23} />
          </div>

          <div className="teacher-earnings-payout-amount">
            <span>Available for settlement</span>
            <strong>
              {formatMoney(data.summary.pendingPayout, currency)}
            </strong>
          </div>

          <div className="teacher-earnings-payout-lines">
            <div>
              <span>Paid out</span>
              <strong>{formatMoney(data.summary.paidOut, currency)}</strong>
            </div>
            <div>
              <span>Refunded</span>
              <strong>{formatMoney(data.summary.refunds, currency)}</strong>
            </div>
            <div>
              <span>Pending payments</span>
              <strong>{data.summary.pendingTransactions}</strong>
            </div>
          </div>

          <div className="teacher-earnings-payout-note">
            <ShieldCheck size={18} />
            <p>
              Razorpay payout execution will activate after production payout
              credentials and the teacher bank-verification flow are enabled.
            </p>
          </div>
        </Card>
      </section>

      <Card className="teacher-earnings-transactions-card">
        <div className="teacher-earnings-card-heading teacher-earnings-transactions-heading">
          <div>
            <span>Payment activity</span>
            <h2>Transactions</h2>
          </div>
          <Badge tone="neutral">
            {data.pagination.total} records
          </Badge>
        </div>

        <form
          className="teacher-earnings-filters"
          onSubmit={submitSearch}
        >
          <label>
            Period
            <select
              value={period}
              onChange={(event) =>
                changePeriod(event.target.value as EarningsPeriod)
              }
            >
              {PERIODS.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Payment
            <select
              value={status}
              onChange={(event) =>
                changeStatus(
                  event.target.value as EarningsPaymentStatus,
                )
              }
            >
              {PAYMENT_STATUSES.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Payout
            <select
              value={payoutStatus}
              onChange={(event) =>
                changePayoutStatus(
                  event.target.value as EarningsPayoutStatus,
                )
              }
            >
              {PAYOUT_STATUSES.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="teacher-earnings-search">
            Search
            <div>
              <Search size={17} />
              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Student, subject, topic or payment ID"
              />
              <Button type="submit">Search</Button>
            </div>
          </label>
        </form>

        {data.transactions.length ? (
          <>
            <div className="teacher-earnings-table-wrap">
              <table className="teacher-earnings-table">
                <thead>
                  <tr>
                    <th>Student & session</th>
                    <th>Payment</th>
                    <th>Deductions</th>
                    <th>Your earning</th>
                    <th>Payout</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((transaction) => (
                    <TransactionRow
                      transaction={transaction}
                      key={transaction.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="teacher-earnings-pagination">
              <span>
                Page {data.pagination.page} of{' '}
                {data.pagination.totalPages}
              </span>
              <div>
                <Button
                  className="button-secondary"
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                  disabled={data.pagination.page <= 1}
                >
                  <ArrowLeft size={16} /> Previous
                </Button>
                <Button
                  className="button-secondary"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(
                        data.pagination.totalPages,
                        current + 1,
                      ),
                    )
                  }
                  disabled={
                    data.pagination.page >= data.pagination.totalPages
                  }
                >
                  Next <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="teacher-earnings-empty">
            <Banknote size={36} />
            <h3>No earnings match these filters</h3>
            <p>
              Paid teaching sessions and their settlement details will appear
              here.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

function TransactionRow({
  transaction,
}: {
  transaction: TeacherEarningsTransaction
}) {
  return (
    <tr>
      <td>
        <div className="teacher-earnings-session-cell">
          <div className="teacher-earnings-student-avatar">
            {transaction.student.avatar ? (
              <img src={transaction.student.avatar} alt="" />
            ) : (
              transaction.student.name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <strong>{transaction.student.name}</strong>
            <span>
              {transaction.subject} · {transaction.topicName}
            </span>
            <small>
              Session {formatDate(transaction.sessionDate)}
            </small>
          </div>
        </div>
      </td>
      <td>
        <div className="teacher-earnings-status-cell">
          <Badge tone={paymentTone(transaction.paymentStatus)}>
            {label(transaction.paymentStatus)}
          </Badge>
          <span>
            {label(transaction.paymentMethod)} ·{' '}
            {label(transaction.paymentGateway)}
          </span>
        </div>
      </td>
      <td>
        <strong>
          {formatMoney(
            transaction.totalDeduction,
            transaction.currency,
          )}
        </strong>
        <span className="teacher-earnings-cell-muted">
          Platform fee
        </span>
      </td>
      <td>
        <strong className="teacher-earnings-positive">
          {formatMoney(
            transaction.teacherEarning,
            transaction.currency,
          )}
        </strong>
        <span className="teacher-earnings-cell-muted">
          Gross{' '}
          {formatMoney(transaction.totalAmount, transaction.currency)}
        </span>
      </td>
      <td>
        <Badge tone={payoutTone(transaction.payoutStatus)}>
          {label(transaction.payoutStatus)}
        </Badge>
      </td>
      <td>
        <strong>
          {formatDateTime(
            transaction.paidAt ?? transaction.createdAt,
          )}
        </strong>
        {transaction.gatewayPaymentId ? (
          <span className="teacher-earnings-payment-id">
            {transaction.gatewayPaymentId}
          </span>
        ) : null}
      </td>
    </tr>
  )
}

function TeacherEarningsSkeleton() {
  return (
    <div className="teacher-earnings-page">
      <div className="teacher-earnings-header">
        <div>
          <div className="teacher-earnings-skeleton-line short" />
          <div className="teacher-earnings-skeleton-line title" />
          <div className="teacher-earnings-skeleton-line" />
        </div>
      </div>
      <div className="teacher-earnings-stat-grid">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="skeleton" key={index} />
        ))}
      </div>
      <div className="teacher-earnings-overview-grid">
        <div className="skeleton teacher-earnings-large-skeleton" />
        <div className="skeleton teacher-earnings-large-skeleton" />
      </div>
      <div className="skeleton teacher-earnings-table-skeleton" />
    </div>
  )
}
