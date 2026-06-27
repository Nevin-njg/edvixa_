import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute, RoleRoute } from '../components/guards'
import { PortalLayout } from '../components/portal-layout'
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage, VerifyEmailPage } from '../features/auth/pages'
import { AdminDashboardPage, ComingSoonPage, SubjectsPage, TeacherApprovalsPage } from '../features/dashboards/pages'
import { StudentDashboardPage } from '../features/student/dashboard'
import { StudentDoubtPollsPage } from '../features/student/doubts'
import { ActivePracticePage, PracticeSetupPage } from '../features/student/practice'
import { StudentProgressPage } from '../features/student/progress'
import { StudentProfilePage } from '../features/student/profile'
import { AnswerReviewPage, PracticeResultPage, ResultsHistoryPage } from '../features/student/results'
import { BookingCheckoutPage } from '../features/student/checkout'
import { StudentSessionsPage } from '../features/student/sessions'
import { TeacherDiscoveryPage, TeacherProfilePage } from '../features/student/teachers'
import { TeacherDashboardPage } from '../features/teacher/dashboard'
import { TeacherBookingRequestsPage } from '../features/teacher/bookings'
import { TeacherSessionsPage } from '../features/teacher/sessions'
import { TeacherEarningsPage } from '../features/teacher/earnings'
import { TeacherDoubtPollsPage } from '../features/teacher/doubts'
import { TeacherProfileSetupPage } from '../features/teacher/profile'
import { TeacherSlotsPage } from '../features/teacher/slots'
import { AccessDeniedPage, LandingPage, NotFoundPage } from '../features/shared/pages'

const coming=(title:string)=><ComingSoonPage title={title}/>
export const router=createBrowserRouter([
  {path:'/',element:<LandingPage/>},{path:'/login',element:<LoginPage/>},{path:'/register',element:<RegisterPage/>},{path:'/forgot-password',element:<ForgotPasswordPage/>},{path:'/reset-password',element:<ResetPasswordPage/>},{path:'/verify-email',element:<VerifyEmailPage/>},{path:'/access-denied',element:<AccessDeniedPage/>},
  {element:<ProtectedRoute/>,children:[
    {element:<RoleRoute roles={['student']}/>,children:[{path:'/student',element:<PortalLayout/>,children:[{path:'dashboard',element:<StudentDashboardPage/>},{path:'profile',element:<StudentProfilePage/>},{path:'practice',element:<PracticeSetupPage/>},{path:'practice/:id',element:<ActivePracticePage/>},{path:'results',element:<ResultsHistoryPage/>},{path:'results/:id',element:<PracticeResultPage/>},{path:'results/:id/review',element:<AnswerReviewPage/>},{path:'progress',element:<StudentProgressPage/>},{path:'doubts',element:<StudentDoubtPollsPage/>},{path:'leaderboard',element:coming('Leaderboard')},{path:'teachers',element:<TeacherDiscoveryPage/>},{path:'teachers/:id',element:<TeacherProfilePage/>},{path:'checkout',element:<BookingCheckoutPage/>},{path:'sessions',element:<StudentSessionsPage/>},{path:'notifications',element:coming('Notifications')},{path:'fees',element:coming('Fee History')}]}]},
    {element:<RoleRoute roles={['teacher']}/>,children:[{path:'/teacher',element:<PortalLayout/>,children:[{path:'dashboard',element:<TeacherDashboardPage/>},{path:'profile',element:<TeacherProfileSetupPage/>},{path:'slots',element:<TeacherSlotsPage/>},{path:'bookings',element:<TeacherBookingRequestsPage/>},{path:'doubts',element:<TeacherDoubtPollsPage/>},{path:'sessions',element:<TeacherSessionsPage/>},{path:'earnings',element:<TeacherEarningsPage/>}]}]},
    {element:<RoleRoute roles={['admin']}/>,children:[{path:'/admin',element:<PortalLayout/>,children:[{path:'dashboard',element:<AdminDashboardPage/>},{path:'users',element:coming('User Management')},{path:'users/:id',element:coming('User Details')},{path:'teachers',element:<TeacherApprovalsPage/>},{path:'bookings',element:coming('All Bookings')},{path:'fees',element:coming('Fee Management')},{path:'subjects',element:<SubjectsPage/>},{path:'analytics',element:coming('Analytics')},{path:'reports',element:coming('Reports')},{path:'notifications',element:coming('Notification Management')},{path:'settings',element:coming('Platform Settings')},{path:'roles',element:coming('Roles and Permissions')},{path:'security',element:coming('Security and Audit Logs')},{path:'support',element:coming('Support Centre')}]}]},
  ]},
  {path:'*',element:<NotFoundPage/>},
])
