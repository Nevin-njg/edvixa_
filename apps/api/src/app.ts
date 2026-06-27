import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middlewares/error.middleware.js'
import { asyncHandler } from './shared/http/async-handler.js'
import { adminRouter } from './modules/admin/routes/admin.routes.js'
import { authRouter } from './modules/auth/routes/auth.routes.js'
import { bookingRouter } from './modules/bookings/routes/booking.routes.js'
import { teacherBookingRouter } from './modules/bookings/routes/teacher-booking.routes.js'
import { teacherSessionRouter } from './modules/bookings/routes/teacher-session.routes.js'
import { teacherEarningsRouter } from './modules/teacher-earnings/routes/teacher-earnings.routes.js'
import { teacherStudentRouter } from './modules/teacher-students/routes/teacher-student.routes.js'
import { doubtPollRouter } from './modules/doubt-polls/routes/doubt-poll.routes.js'
import { practiceRouter } from './modules/practice/routes/practice.routes.js'
import { razorpayWebhook } from './modules/payments/controllers/razorpay-webhook.controller.js'
import { studentRouter } from './modules/students/routes/student.routes.js'
import { subjectRouter } from './modules/subjects/routes/subject.routes.js'
import { teacherRouter } from './modules/teachers/routes/teacher.routes.js'
import { userRouter } from './modules/users/routes/user.routes.js'

export const app = express()
app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({ origin: env.CLIENT_URL, credentials: true }))
app.post(
  '/api/v1/payments/razorpay/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(razorpayWebhook),
)
app.use(express.json({ limit: '3mb' }))
app.use(cookieParser())
app.get('/api/v1/health', (_req, res) => res.json({ success: true, data: { service: 'edvixa-api', status: 'ok' } }))
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/bookings', bookingRouter)
app.use('/api/v1/teacher-bookings', teacherBookingRouter)
app.use('/api/v1/teacher-sessions', teacherSessionRouter)
app.use('/api/v1/teacher-earnings', teacherEarningsRouter)
app.use('/api/v1/teacher-students', teacherStudentRouter)
app.use('/api/v1/doubt-polls', doubtPollRouter)
app.use('/api/v1/users', userRouter)
app.use('/api/v1/students', studentRouter)
app.use('/api/v1/practice', practiceRouter)
app.use('/api/v1/teachers', teacherRouter)
app.use('/api/v1/subjects', subjectRouter)
app.use('/api/v1/admin', adminRouter)
app.use(notFound)
app.use(errorHandler)
