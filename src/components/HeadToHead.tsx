import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatDate } from '../utils/date'
import { fetchMatches, type MatchRecord } from '../services/matches'
import { useAuth } from '../lib/auth'
import { fetchPlayerTeamOwnerships, type OwnedMatchupTeam } from '../services/matchups'

type Result = 'win' | 'draw' | 'loss'
type Record = { wins: number; draws: number; losses: number }
type BreakdownRow = Record & { name: string; games: number }
type TeamMatchupStatus = 'fresh' | 'played' | 'mirror'

const emptyRecord = (): Record => ({ wins: 0, draws: 0, losses: 0 })

const getResult = (match: MatchRecord, player: string): Result => {
  if (match.isTied || match.player1Score != null && match.player2Score != null && match.player1Score === match.player2Score) return 'draw'

  const playerWon = match.player1Score != null && match.player2Score != null
    ? (match.player1 === player ? match.player1Score > match.player2Score : match.player2Score > match.player1Score)
    : match.player1 === player

  return playerWon ? 'win' : 'loss'
}

const addResult = (record: Record, result: Result) => {
  if (result === 'win') record.wins += 1
  else if (result === 'draw') record.draws += 1
  else record.losses += 1
}

const formatRecord = (record: Record) => `${record.wins}–${record.draws}–${record.losses}`

const getWinRate = (record: Record) => {
  const games = record.wins + record.draws + record.losses
  return games === 0 ? 0 : (record.wins + record.draws * .5) / games * 100
}

const getStreak = (matches: MatchRecord[], player: string) => {
  let wins = 0
  for (const match of [...matches].sort((first, second) => second.date.localeCompare(first.date))) {
    if (getResult(match, player) !== 'win') break
    wins += 1
  }
  return wins
}

const getLongestStreak = (matches: MatchRecord[], player: string) => {
  let longest = 0
  let current = 0
  for (const match of [...matches].sort((first, second) => first.date.localeCompare(second.date))) {
    if (getResult(match, player) === 'win') {
      current += 1
      longest = Math.max(longest, current)
    } else current = 0
  }
  return longest
}

const getAverageScore = (matches: MatchRecord[], player: string) => {
  const scores = matches.flatMap((match) => {
    const score = match.player1 === player ? match.player1Score : match.player2Score
    return score == null ? [] : [score]
  })
  return scores.length === 0 ? null : scores.reduce((total, score) => total + score, 0) / scores.length
}

const getTeamGamesAgainstOpponent = (matches: MatchRecord[], player: string, opponent: string, team: string) => matches.filter((match) => (
  match.player1 === player
  && match.player2 === opponent
  && match.teamOne === team
) || (
  match.player1 === opponent
  && match.player2 === player
  && match.teamTwo === team
)).length

const getBreakdown = (matches: MatchRecord[], player: string, key: 'team' | 'map') => {
  const rows = new Map<string, BreakdownRow>()
  matches.forEach((match) => {
    const name = key === 'team' ? (match.player1 === player ? match.teamOne : match.teamTwo) : match.map
    const row = rows.get(name) ?? { name, games: 0, ...emptyRecord() }
    row.games += 1
    addResult(row, getResult(match, player))
    rows.set(name, row)
  })
  return [...rows.values()].sort((first, second) => second.games - first.games || first.name.localeCompare(second.name))
}

function HeadToHead({ isActive }: { isActive: boolean }) {
  const { loading: isAuthLoading, player } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [ownedTeams, setOwnedTeams] = useState<Map<string, OwnedMatchupTeam[]>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingOwnedTeams, setIsLoadingOwnedTeams] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ownedTeamsError, setOwnedTeamsError] = useState<string | null>(null)
  const playerOne = searchParams.get('player1') ?? ''
  const playerTwo = searchParams.get('player2') ?? ''
  const dateFrom = searchParams.get('from') ?? ''
  const dateTo = searchParams.get('to') ?? ''
  const ignoreHomebrew = searchParams.get('ignoreHomebrew') === 'true'
  const excludeHomebrewTeams = searchParams.get('excludeHomebrewTeams') === 'true'

  useEffect(() => {
    let isCurrent = true
    fetchMatches()
      .then((loadedMatches) => {
        if (!isCurrent) return
        setMatches(loadedMatches)
      })
      .catch((cause: unknown) => {
        if (!isCurrent) return
        setError(cause instanceof Error ? cause.message : 'Failed to load matches.')
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })
    return () => { isCurrent = false }
  }, [])

  useEffect(() => {
    let isCurrent = true
    fetchPlayerTeamOwnerships()
      .then((loadedTeams) => {
        if (isCurrent) setOwnedTeams(loadedTeams)
      })
      .catch((cause: unknown) => {
        if (isCurrent) setOwnedTeamsError(cause instanceof Error ? cause.message : 'Failed to load player teams.')
      })
      .finally(() => {
        if (isCurrent) setIsLoadingOwnedTeams(false)
      })
    return () => { isCurrent = false }
  }, [])

  const players = useMemo(() => [...new Set(matches.flatMap((match) => [match.player1, match.player2]))].sort(), [matches])
  useEffect(() => {
    if (isAuthLoading || players.length === 0) return

    const nextPlayerOne = players.includes(playerOne)
      ? playerOne
      : player?.name && players.includes(player.name)
        ? player.name
        : players[0]
    const nextPlayerTwo = playerTwo !== nextPlayerOne && players.includes(playerTwo)
      ? playerTwo
      : players.find((candidate) => candidate !== nextPlayerOne) ?? nextPlayerOne

    if (nextPlayerOne === playerOne && nextPlayerTwo === playerTwo) return
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('player1', nextPlayerOne)
      next.set('player2', nextPlayerTwo)
      return next
    })
  }, [isAuthLoading, player?.name, playerOne, playerTwo, players, setSearchParams])

  const updateParam = (name: string, value: string | null) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(name, value)
      else next.delete(name)
      return next
    })
  }
  const rivalryMatches = useMemo(() => matches
    .filter((match) => (
      playerOne
      && playerTwo
      && playerOne !== playerTwo
      && [match.player1, match.player2].includes(playerOne)
      && [match.player1, match.player2].includes(playerTwo)
      && (!ignoreHomebrew || !match.isHomebrew)
      && (!dateFrom || match.date >= dateFrom)
      && (!dateTo || match.date <= dateTo)
    ))
    .sort((first, second) => second.date.localeCompare(first.date)), [dateFrom, dateTo, ignoreHomebrew, matches, playerOne, playerTwo])
  const playerOneRecord = useMemo(() => rivalryMatches.reduce<Record>((record, match) => {
    addResult(record, getResult(match, playerOne))
    return record
  }, emptyRecord()), [playerOne, rivalryMatches])
  const playerTwoRecord = useMemo(() => rivalryMatches.reduce<Record>((record, match) => {
    addResult(record, getResult(match, playerTwo))
    return record
  }, emptyRecord()), [playerTwo, rivalryMatches])
  const playerOneTeams = useMemo(() => getBreakdown(rivalryMatches, playerOne, 'team'), [playerOne, rivalryMatches])
  const playerTwoTeams = useMemo(() => getBreakdown(rivalryMatches, playerTwo, 'team'), [playerTwo, rivalryMatches])
  const playerOneMaps = useMemo(() => getBreakdown(rivalryMatches, playerOne, 'map'), [playerOne, rivalryMatches])
  const playerTwoMaps = useMemo(() => getBreakdown(rivalryMatches, playerTwo, 'map'), [playerTwo, rivalryMatches])
  const freshTeamMatchups = useMemo(() => {
    if (!playerOne || !playerTwo || playerOne === playerTwo) return []
    const sortByGames = (teams: OwnedMatchupTeam[], player: string, opponent: string) => [...teams]
      .filter((team) => !excludeHomebrewTeams || !team.isHomebrew)
      .sort((first, second) => (
        getTeamGamesAgainstOpponent(matches, player, opponent, first.name)
        - getTeamGamesAgainstOpponent(matches, player, opponent, second.name)
        || first.name.localeCompare(second.name)
      ))
    const firstTeams = sortByGames(ownedTeams.get(playerOne) ?? [], playerOne, playerTwo)
    const secondTeams = sortByGames(ownedTeams.get(playerTwo) ?? [], playerTwo, playerOne)
    return firstTeams.flatMap((firstTeam) => secondTeams.flatMap((secondTeam) => {
      if (firstTeam.name === secondTeam.name) return []
      const hasBeenPlayed = matches.some((match) => (
        match.player1 === playerOne
        && match.player2 === playerTwo
        && match.teamOne === firstTeam.name
        && match.teamTwo === secondTeam.name
      ) || (
        match.player1 === playerTwo
        && match.player2 === playerOne
        && match.teamOne === secondTeam.name
        && match.teamTwo === firstTeam.name
      ))
      return hasBeenPlayed ? [] : [{ firstTeam: firstTeam.name, secondTeam: secondTeam.name }]
    }))
  }, [excludeHomebrewTeams, matches, ownedTeams, playerOne, playerTwo])
  const freshTeamMatchupGroups = useMemo(() => {
    const opponentsByTeam = new Map<string, string[]>()
    freshTeamMatchups.forEach(({ firstTeam, secondTeam }) => {
      opponentsByTeam.set(firstTeam, [...(opponentsByTeam.get(firstTeam) ?? []), secondTeam])
    })
    return [...opponentsByTeam.entries()].map(([firstTeam, secondTeams]) => ({ firstTeam, secondTeams }))
  }, [freshTeamMatchups])
  const teamMatchupMatrix = useMemo(() => {
    if (!playerOne || !playerTwo || playerOne === playerTwo) return []
    const sortByGames = (teams: OwnedMatchupTeam[], player: string, opponent: string) => [...teams]
      .filter((team) => !excludeHomebrewTeams || !team.isHomebrew)
      .sort((first, second) => (
        getTeamGamesAgainstOpponent(matches, player, opponent, first.name)
        - getTeamGamesAgainstOpponent(matches, player, opponent, second.name)
        || first.name.localeCompare(second.name)
      ))
    const firstTeams = sortByGames(ownedTeams.get(playerOne) ?? [], playerOne, playerTwo)
    const secondTeams = sortByGames(ownedTeams.get(playerTwo) ?? [], playerTwo, playerOne)
    return firstTeams.map((firstTeam) => ({
      firstTeam: firstTeam.name,
      cells: secondTeams.map((secondTeam) => {
        if (firstTeam.name === secondTeam.name) return { secondTeam: secondTeam.name, status: 'mirror' as TeamMatchupStatus }
        const hasBeenPlayed = matches.some((match) => (
          match.player1 === playerOne
          && match.player2 === playerTwo
          && match.teamOne === firstTeam.name
          && match.teamTwo === secondTeam.name
        ) || (
          match.player1 === playerTwo
          && match.player2 === playerOne
          && match.teamOne === secondTeam.name
          && match.teamTwo === firstTeam.name
        ))
        return { secondTeam: secondTeam.name, status: hasBeenPlayed ? 'played' as TeamMatchupStatus : 'fresh' as TeamMatchupStatus }
      }),
    }))
  }, [excludeHomebrewTeams, matches, ownedTeams, playerOne, playerTwo])
  const hasFilters = Boolean(dateFrom || dateTo || ignoreHomebrew || excludeHomebrewTeams)

  const clearFilters = () => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('from')
      next.delete('to')
      next.delete('ignoreHomebrew')
      next.delete('excludeHomebrewTeams')
      return next
    })
  }

  if (isLoading) return <div hidden={!isActive} className="head-to-head-state">Loading rivalry data…</div>
  if (error) return <div hidden={!isActive} className="head-to-head-state head-to-head-error">Could not load rivalry data: {error}</div>

  return (
    <div hidden={!isActive}>
      <section className="head-to-head-hero" aria-labelledby="head-to-head-heading">
        <p className="section-kicker">Head to head</p>
        <h2 id="head-to-head-heading">All-time record</h2>
        <div className="head-to-head-selectors">
          <label>Player one<select value={playerOne} onChange={(event) => updateParam('player1', event.target.value)}>{players.map((player) => <option key={player} value={player} disabled={player === playerTwo}>{player}</option>)}</select></label>
          <span aria-hidden="true">vs</span>
          <label>Player two<select value={playerTwo} onChange={(event) => updateParam('player2', event.target.value)}>{players.map((player) => <option key={player} value={player} disabled={player === playerOne}>{player}</option>)}</select></label>
        </div>
        <div className="head-to-head-filters">
          <label>From<input type="date" value={dateFrom} onChange={(event) => updateParam('from', event.target.value)} max={dateTo || undefined} /></label>
          <label>To<input type="date" value={dateTo} onChange={(event) => updateParam('to', event.target.value)} min={dateFrom || undefined} /></label>
          <label className="head-to-head-checkbox"><input type="checkbox" checked={ignoreHomebrew} onChange={(event) => updateParam('ignoreHomebrew', event.target.checked ? 'true' : null)} />Ignore homebrew games</label>
          <label className="head-to-head-checkbox"><input type="checkbox" checked={excludeHomebrewTeams} onChange={(event) => updateParam('excludeHomebrewTeams', event.target.checked ? 'true' : null)} />Exclude homebrew teams</label>
          {hasFilters && <button type="button" className="clear-filters" onClick={clearFilters}>Clear filters</button>}
        </div>
        {playerOne !== playerTwo && rivalryMatches.length > 0 ? <>
          <div className="head-to-head-scoreboard">
            <div><span>{playerOne} wins</span><strong>{playerOneRecord.wins}</strong><small>{getWinRate(playerOneRecord).toFixed(0)}%</small></div>
            <div><span>Draws</span><strong>{playerOneRecord.draws}</strong><small>{(playerOneRecord.draws / rivalryMatches.length * 100).toFixed(0)}%</small></div>
            <div><span>{playerTwo} wins</span><strong>{playerTwoRecord.wins}</strong><small>{getWinRate(playerTwoRecord).toFixed(0)}%</small></div>
          </div>
          <p className="head-to-head-summary">{rivalryMatches.length} {rivalryMatches.length === 1 ? 'game' : 'games'} played · Last encounter {formatDate(rivalryMatches[0].date)}</p>
          <div className="head-to-head-highlights">
            <Highlight label="Average points" one={getAverageScore(rivalryMatches, playerOne)?.toFixed(1) ?? 'N/A'} two={getAverageScore(rivalryMatches, playerTwo)?.toFixed(1) ?? 'N/A'} />
            <Highlight label="Current win streak" one={`${getStreak(rivalryMatches, playerOne)}`} two={`${getStreak(rivalryMatches, playerTwo)}`} />
            <Highlight label="Longest win streak" one={`${getLongestStreak(rivalryMatches, playerOne)}`} two={`${getLongestStreak(rivalryMatches, playerTwo)}`} />
          </div>
        </> : <div className="empty-state"><strong>No rivalry matches found</strong><span>Select two different players or clear filters.</span></div>}
      </section>
      {rivalryMatches.length > 0 && <section className="head-to-head-section" aria-labelledby="rivalry-breakdown-heading">
        <header className="community-section-heading"><h3 id="rivalry-breakdown-heading">Rivalry breakdown</h3><span>Only games between these players</span></header>
        <div className="head-to-head-breakdowns">
          <Breakdown title="Teams" onePlayer={playerOne} twoPlayer={playerTwo} oneRows={playerOneTeams} twoRows={playerTwoTeams} />
          <Breakdown title="Maps" onePlayer={playerOne} twoPlayer={playerTwo} oneRows={playerOneMaps} twoRows={playerTwoMaps} />
        </div>
      </section>}
      <section className="fresh-team-matchups" aria-labelledby="fresh-team-matchups-heading">
        <header className="community-section-heading"><h3 id="fresh-team-matchups-heading">Fresh team matchups</h3><span>Owned non-mirror teams never used against each other</span></header>
        {isLoadingOwnedTeams ? <p className="fresh-team-matchups-status">Loading player teams…</p> : ownedTeamsError ? <p className="fresh-team-matchups-status fresh-team-matchups-error">Could not load player teams: {ownedTeamsError}</p> : playerOne && playerTwo && playerOne !== playerTwo ? freshTeamMatchupGroups.length > 0 ? <div className="fresh-team-matchups-list" role="list">{freshTeamMatchupGroups.map(({ firstTeam, secondTeams }) => <details key={firstTeam} role="listitem"><summary><span>{playerOne}<strong>{firstTeam}</strong></span><small>{secondTeams.length} fresh {secondTeams.length === 1 ? 'opponent' : 'opponents'}</small></summary><div className="fresh-team-opponents" aria-label={`Fresh opponents for ${firstTeam}`}>{secondTeams.map((secondTeam) => <div key={secondTeam}><span>{playerTwo}</span><strong>{secondTeam}</strong></div>)}</div></details>)}</div> : <div className="empty-state"><strong>No fresh team matchups</strong><span>Every non-mirror owned team pairing between these players has been recorded.</span></div> : <div className="empty-state"><strong>Choose two players</strong><span>Players need at least one owned team.</span></div>}
        {!isLoadingOwnedTeams && !ownedTeamsError && playerOne && playerTwo && playerOne !== playerTwo && teamMatchupMatrix.length > 0 && <div className="fresh-team-matrix-wrap"><header><h4>Team matchup matrix</h4><div className="fresh-team-matrix-legend"><span><i className="fresh" />Fresh</span><span><i className="played" />Played</span><span><i className="mirror" />Mirror</span></div></header><div className="fresh-team-matrix-scroll"><table className="fresh-team-matrix"><thead><tr><th className="matrix-row-heading" scope="col" rowSpan={2}>Rows<br />{playerOne}</th><th className="matrix-column-heading" scope="colgroup" colSpan={teamMatchupMatrix[0].cells.length}>Columns: {playerTwo}</th></tr><tr>{teamMatchupMatrix[0].cells.map(({ secondTeam }) => <th scope="col" key={secondTeam}>{secondTeam}</th>)}</tr></thead><tbody>{teamMatchupMatrix.map(({ firstTeam, cells }) => <tr key={firstTeam}><th scope="row">{firstTeam}</th>{cells.map(({ secondTeam, status }) => <td className={status} key={secondTeam} title={status === 'fresh' ? `${firstTeam} versus ${secondTeam} has not been played` : status === 'played' ? `${firstTeam} versus ${secondTeam} has been played` : 'Mirror matches are excluded'}>{status === 'fresh' ? 'Fresh' : status === 'played' ? 'Played' : '—'}</td>)}</tr>)}</tbody></table></div></div>}
      </section>
      {rivalryMatches.length > 0 && <section className="head-to-head-section" aria-labelledby="rivalry-history-heading">
        <header className="community-section-heading"><h3 id="rivalry-history-heading">Rivalry history</h3><span>Open any match for full details</span></header>
        <div className="head-to-head-history"><table><thead><tr><th>Date</th><th>{playerOne}</th><th>Result</th><th>{playerTwo}</th><th>Map</th></tr></thead><tbody>{rivalryMatches.map((match) => {
          const firstPlayer = match.player1 === playerOne
          const oneTeam = firstPlayer ? match.teamOne : match.teamTwo
          const twoTeam = firstPlayer ? match.teamTwo : match.teamOne
          const oneScore = firstPlayer ? match.player1Score : match.player2Score
          const twoScore = firstPlayer ? match.player2Score : match.player1Score
          const content = <><time dateTime={match.date}>{formatDate(match.date)}</time><span>{oneTeam}</span><strong>{oneScore ?? '—'}–{twoScore ?? '—'}</strong><span>{twoTeam}</span><span>{match.map}</span></>
          return <tr key={match.id ?? `${match.date}-${match.player1}-${match.player2}`}>{match.id ? <td colSpan={5}><Link className="head-to-head-history-link" to={`/matches?match=${encodeURIComponent(match.id)}`}>{content}</Link></td> : <td colSpan={5}><span className="head-to-head-history-link">{content}</span></td>}</tr>
        })}</tbody></table></div>
      </section>}
    </div>
  )
}

function Highlight({ label, one, two }: { label: string; one: string; two: string }) {
  return <div><strong>{one}<span>/</span>{two}</strong><small>{label}</small></div>
}

function Breakdown({ title, onePlayer, twoPlayer, oneRows, twoRows }: { title: string; onePlayer: string; twoPlayer: string; oneRows: BreakdownRow[]; twoRows: BreakdownRow[] }) {
  const rows = [...new Set([...oneRows, ...twoRows].map((row) => row.name))].map((name) => ({
    name,
    one: oneRows.find((row) => row.name === name),
    two: twoRows.find((row) => row.name === name),
  }))
  return <div className="head-to-head-breakdown"><h4>{title}</h4><table><thead><tr><th>{title.slice(0, -1)}</th><th>{onePlayer}</th><th>{twoPlayer}</th></tr></thead><tbody>{rows.map(({ name, one, two }) => <tr key={name}><th scope="row">{name}</th><td>{one ? <>{one.games} · {formatRecord(one)}<small>{getWinRate(one).toFixed(0)}%</small></> : '—'}</td><td>{two ? <>{two.games} · {formatRecord(two)}<small>{getWinRate(two).toFixed(0)}%</small></> : '—'}</td></tr>)}</tbody></table></div>
}

export default HeadToHead
