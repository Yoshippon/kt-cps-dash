import { useState } from 'react'
import Ledger from './components/Ledger'
import Matchups from './components/Matchups'
import Community from './components/Community'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState<'matches' | 'matchups' | 'community'>('matches')

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">KT</span><h1>Kill Team Campinas</h1></div>
      </header>
      <nav className="tabs" aria-label="Dashboard views">
        <button className={activeTab === 'matches' ? 'tab active' : 'tab'} type="button" onClick={() => setActiveTab('matches')}>Matches</button>
        <button className={activeTab === 'matchups' ? 'tab active' : 'tab'} type="button" onClick={() => setActiveTab('matchups')}>Matchups</button>
        <button className={activeTab === 'community' ? 'tab active' : 'tab'} type="button" onClick={() => setActiveTab('community')}>Community</button>
      </nav>
      <Ledger isActive={activeTab === 'matches'} />
      <Matchups isActive={activeTab === 'matchups'} />
      <Community isActive={activeTab === 'community'} />
    </main>
  )
}

export default App
