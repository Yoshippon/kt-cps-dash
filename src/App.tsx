import { Navigate, NavLink, Route, Routes } from 'react-router'
import Ledger from './components/Ledger'
import Matchups from './components/Matchups'
import Community from './components/Community'
import NextMeeting from './components/NextMeeting'
import KillTeams from './components/KillTeams'
import AdminPlayers from './components/AdminPlayers'
import AccountMenu from './components/AccountMenu'
import ClaimBanner from './components/ClaimBanner'
import Profile from './components/Profile'
import { AuthProvider, useAuth } from './lib/auth'
import './App.css'

function AppShell() {
  const { isAdmin, isLoggedIn } = useAuth()
  const tabClassName = ({ isActive }: { isActive: boolean }) => isActive ? 'tab active' : 'tab'

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">KT</span><h1>Kill Team Campinas</h1></div>
        <AccountMenu />
      </header>
      <ClaimBanner />
      <nav className="tabs" aria-label="Dashboard views">
        <NavLink className={tabClassName} to="/next-meeting">Next Meeting</NavLink>
        <NavLink className={tabClassName} to="/matches">Matches</NavLink>
        <NavLink className={tabClassName} to="/matchups">Matchups</NavLink>
        <NavLink className={tabClassName} to="/community">Community</NavLink>
        <NavLink className={tabClassName} to="/kill-teams">Kill Teams</NavLink>
        {isLoggedIn && <NavLink className={tabClassName} to="/profile">Profile</NavLink>}
        {isAdmin && <NavLink className={tabClassName} to="/admin">Admin</NavLink>}
      </nav>
      <Routes>
        <Route path="/" element={<Navigate replace to="/next-meeting" />} />
        <Route path="/next-meeting" element={<NextMeeting isActive />} />
        <Route path="/matches" element={<Ledger isActive />} />
        <Route path="/matchups" element={<Matchups isActive />} />
        <Route path="/community" element={<Community isActive />} />
        <Route path="/kill-teams" element={<KillTeams isActive />} />
        <Route path="/profile" element={isLoggedIn ? <Profile isActive /> : <Navigate replace to="/next-meeting" />} />
        <Route path="/admin" element={isAdmin ? <AdminPlayers isActive /> : <Navigate replace to="/next-meeting" />} />
        <Route path="*" element={<Navigate replace to="/next-meeting" />} />
      </Routes>
    </main>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
