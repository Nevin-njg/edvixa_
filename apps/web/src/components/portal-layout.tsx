import { BookOpen, CalendarDays, ChartNoAxesCombined, CircleDollarSign, ClipboardCheck, LayoutDashboard, LogOut, MessageSquareWarning, Settings, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth.store'

const menus = {
  student: [
    ['/student/dashboard','Dashboard',LayoutDashboard], ['/student/practice','AI Practice',ClipboardCheck], ['/student/results','Results',BookOpen], ['/student/progress','Progress',ChartNoAxesCombined], ['/student/doubts','Doubt Polls',MessageSquareWarning], ['/student/teachers','Book Teacher',UsersRound], ['/student/sessions','My Sessions',CalendarDays], ['/student/profile','Profile',UserRound],
  ],
  teacher: [
    ['/teacher/dashboard','Dashboard',LayoutDashboard], ['/teacher/bookings','Booking Requests',ClipboardCheck], ['/teacher/doubts','Student Doubts',MessageSquareWarning], ['/teacher/slots','Manage Slots',CalendarDays], ['/teacher/sessions','Sessions',BookOpen], ['/teacher/earnings','Earnings',CircleDollarSign], ['/teacher/profile','Profile',UserRound],
  ],
  admin: [
    ['/admin/dashboard','Dashboard',LayoutDashboard], ['/admin/users','Users',UsersRound], ['/admin/teachers','Teacher Approvals',ShieldCheck], ['/admin/bookings','Bookings',CalendarDays], ['/admin/fees','Fees',CircleDollarSign], ['/admin/subjects','Subjects',BookOpen], ['/admin/settings','Settings',Settings],
  ],
} as const

export function PortalLayout() {
  const user=useAuthStore(s=>s.user)!; const clear=useAuthStore(s=>s.clearSession); const navigate=useNavigate()
  const logout=async()=>{ try{await api.post('/auth/logout')}finally{clear();navigate('/login')} }
  return <div className="portal"><aside className="sidebar"><div className="brand"><span className="brand-mark">E</span><span>Edvixa</span></div><nav>{menus[user.role].map(([to,label,Icon])=><NavLink key={to} to={to} className={({isActive})=>isActive?'nav-link active':'nav-link'}><Icon size={19}/><span>{label}</span></NavLink>)}</nav><button className="nav-link logout" onClick={logout}><LogOut size={19}/>Logout</button></aside><main className="portal-main"><header className="topbar"><div><p className="muted">Welcome back</p><strong>{user.name}</strong></div><div className="avatar">{user.name.charAt(0).toUpperCase()}</div></header><div className="page-wrap"><Outlet/></div></main></div>
}
