import { useState } from 'react'
import Ledger from './components/Ledger'
import Matchups from './components/Matchups'
import Community from './components/Community'
import NextMeeting from './components/NextMeeting'
import KillTeams from './components/KillTeams'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState<'matches' | 'matchups' | 'community' | 'next-meeting' | 'kill-teams'>('next-meeting')

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">KT</span><h1>Kill Team Campinas</h1></div>
      </header>
      <nav className="tabs" aria-label="Dashboard views">
        <button className={activeTab === 'next-meeting' ? 'tab active' : 'tab'} type="button" onClick={() => setActiveTab('next-meeting')}>Next Meeting</button>
        <button className={activeTab === 'matches' ? 'tab active' : 'tab'} type="button" onClick={() => setActiveTab('matches')}>Matches</button>
        <button className={activeTab === 'matchups' ? 'tab active' : 'tab'} type="button" onClick={() => setActiveTab('matchups')}>Matchups</button>
        <button className={activeTab === 'community' ? 'tab active' : 'tab'} type="button" onClick={() => setActiveTab('community')}>Community</button>
        <button className={activeTab === 'kill-teams' ? 'tab active' : 'tab'} type="button" onClick={() => setActiveTab('kill-teams')}>Kill Teams</button>
      </nav>
      <NextMeeting isActive={activeTab === 'next-meeting'} />
      <Ledger isActive={activeTab === 'matches'} />
      <Matchups isActive={activeTab === 'matchups'} />
      <Community isActive={activeTab === 'community'} />
      <KillTeams isActive={activeTab === 'kill-teams'} />
    </main>
  )
}

export default App
