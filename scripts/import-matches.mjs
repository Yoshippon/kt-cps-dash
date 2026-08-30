import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
)

const source = fs.readFileSync('./src/data.ts', 'utf8')

const mapsMatch = source.match(/export const MAPS:\s*MapData\[\]\s*=\s*(\[[\s\S]*?\])\s*export const MATCHES/)
const matchesMatch = source.match(/export const MATCHES:\s*Match\[\]\s*=\s*(\[[\s\S]*?\])\s*export const TEAMS/)
if (!mapsMatch || !matchesMatch) {
  throw new Error('Could not parse MAPS or MATCHES from src/data.ts')
}

const MAPS = Function(`return (${mapsMatch[1]})`)()
const MATCHES = Function(`return (${matchesMatch[1]})`)()

const { data: players, error: playersError } = await supabase
  .from('players')
  .select('id, name')

if (playersError) throw playersError

const { data: maps, error: mapsError } = await supabase
  .from('maps')
  .select('id, name')

if (mapsError) throw mapsError

const { data: teams, error: teamsError } = await supabase
  .from('teams')
  .select('id, name')

if (teamsError) throw teamsError

const playerIdByName = new Map(players.map((row) => [row.name, row.id]))
const mapIdByName = new Map(maps.map((row) => [row.name, row.id]))
const teamIdByName = new Map(teams.map((row) => [row.name, row.id]))

const rows = []

for (const match of MATCHES) {
  const playerOneId = playerIdByName.get(match.player1)
  const playerTwoId = playerIdByName.get(match.player2)
  const mapId = mapIdByName.get(match.map)
  const teamOneId = teamIdByName.get(match.teamOne)
  const teamTwoId = teamIdByName.get(match.teamTwo)

  if (!mapId || !playerOneId || !playerTwoId) {
    continue
  }

  rows.push({
    date: match.date,
    map_id: mapId,
    team_one_id: teamOneId ?? null,
    team_two_id: teamTwoId ?? null,
    player_one_id: playerOneId,
    player_two_id: playerTwoId,
    is_tied: Boolean(match.isTied),
    is_homebrew: Boolean(match.isHomebrew),
    is_player_one_skip: Boolean(match.isPlayer1Skip),
    is_player_two_skip: Boolean(match.isPlayer2Skip),
    player_one_score: null,
    player_two_score: null,
    player_one_primary: null,
    player_two_primary: null,
    player_one_tac: null,
    player_two_tac: null,
  })
}

const deduped = [...new Map(
  rows.map((row) => [
    `${row.date}:${row.map_id}:${row.player_one_id}:${row.player_two_id}`,
    row,
  ]),
).values()]

const { error } = await supabase
  .from('matches')
  .upsert(deduped, { onConflict: 'date,map_id,player_one_id,player_two_id' })

if (error) throw error

console.log(`Imported ${deduped.length} matches`)