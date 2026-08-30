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

const extractArray = (startLabel) => {
  const start = source.indexOf(startLabel)
  if (start === -1) {
    throw new Error(`Could not find ${startLabel} in src/data.ts`)
  }

  const assignmentIndex = source.indexOf('=', start)
  if (assignmentIndex === -1) {
    throw new Error(`Could not find assignment for ${startLabel} in src/data.ts`)
  }

  const arrayStart = source.indexOf('[', assignmentIndex)
  if (arrayStart === -1) {
    throw new Error(`Could not find array after ${startLabel} in src/data.ts`)
  }

  let depth = 0
  let inString = false
  let stringQuote = null

  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (char === '\\') {
        index += 1
        continue
      }

      if (char === stringQuote) {
        inString = false
        stringQuote = null
      }
      continue
    }

    if (char === '"' || char === '\'' || char === '`') {
      inString = true
      stringQuote = char
      continue
    }

    if (char === '[') {
      depth += 1
      continue
    }

    if (char === ']') {
      depth -= 1
      if (depth === 0) {
        return Function(`return (${source.slice(arrayStart, index + 1)})`)()
      }
    }
  }

  throw new Error(`Could not parse array literal for ${startLabel}`)
}

const MATCHES = extractArray('const FALLBACK_MATCHES')

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

for (const [index, match] of MATCHES.entries()) {
  const playerOneId = playerIdByName.get(match.player1)
  const playerTwoId = playerIdByName.get(match.player2)
  const mapId = mapIdByName.get(match.map)
  const teamOneId = teamIdByName.get(match.teamOne)
  const teamTwoId = teamIdByName.get(match.teamTwo)

  if (!mapId || !playerOneId || !playerTwoId) {
    continue
  }

  rows.push({
    match_id: `match-${index + 1}`,
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

const { error } = await supabase
  .from('matches')
  .upsert(rows, { onConflict: 'match_id' })

if (error) throw error

console.log(`Imported ${rows.length} matches`)