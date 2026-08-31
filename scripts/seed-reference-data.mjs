import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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

const MAPS = extractArray('const FALLBACK_MAPS')
const MATCHES = extractArray('const FALLBACK_MATCHES')
const TEAMS = extractArray('export const TEAMS')

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

const matches = Array.isArray(MATCHES) ? MATCHES : []
const maps = Array.isArray(MAPS) ? MAPS : []
const rawTeams = Array.isArray(TEAMS) ? TEAMS : []

const teamGroups = rawTeams.flatMap((group) =>
  Array.isArray(group) ? group : [group],
)

const killTeamRows = [...new Map(
  teamGroups
    .filter((item) => item && item.killTeam)
    .map((item) => [item.killTeam, { name: item.killTeam }]),
).values()]

const mapRows = [...new Map(
  maps.map((map) => [map.name, { name: map.name, category: map.category }]),
).values()]

const playerNames = [...new Set(
  matches.flatMap((match) => [match.player1, match.player2])
    .concat(maps.flatMap((map) => map.owners)),
)]

const teamNames = [...new Set(
  matches.flatMap((match) => [match.teamOne, match.teamTwo]),
)]

const playerRows = playerNames.map((name) => ({ name }))
const teamRows = teamNames.map((name) => ({ name }))

const tacOpArchetypes = [
  { name: 'Seek And Destroy', description: 'Stake out a kill and remove priority threats.' },
  { name: 'Security', description: 'Protect or secure an objective, asset, or zone.' },
  { name: 'Infiltration', description: 'Move unseen and gain positional advantage.' },
  { name: 'Recon', description: 'Scout, track, and gather battlefield information.' },
]

const { error: archetypeError } = await supabase
  .from('tac_op_archetypes')
  .upsert(tacOpArchetypes, { onConflict: 'name' })

if (archetypeError) throw archetypeError

const { error: playerError } = await supabase
  .from('players')
  .upsert(playerRows, { onConflict: 'name' })

if (playerError) throw playerError

const { error: mapError } = await supabase
  .from('maps')
  .upsert(mapRows, { onConflict: 'name' })

if (mapError) throw mapError

const { error: teamError } = await supabase
  .from('teams')
  .upsert(teamRows, { onConflict: 'name' })

if (teamError) throw teamError

const { error: killTeamError } = await supabase
  .from('kill_teams')
  .upsert(killTeamRows, { onConflict: 'name' })

if (killTeamError) throw killTeamError

const { data: playerData, error: playerFetchError } = await supabase
  .from('players')
  .select('id, name')

if (playerFetchError) throw playerFetchError

const playerIdByName = new Map(playerData.map((row) => [row.name, row.id]))

const { data: mapData, error: mapFetchError } = await supabase
  .from('maps')
  .select('id, name')

if (mapFetchError) throw mapFetchError

const mapIdByName = new Map(mapData.map((row) => [row.name, row.id]))

const { data: teamData, error: teamFetchError } = await supabase
  .from('teams')
  .select('id, name')

if (teamFetchError) throw teamFetchError

const teamIdByName = new Map(teamData.map((row) => [row.name, row.id]))

const mapOwnershipRows = [...new Map(
  maps.flatMap((map) =>
    map.owners.map((owner) => {
      const playerId = playerIdByName.get(owner)
      const mapId = mapIdByName.get(map.name)
      if (!playerId || !mapId) return null
      return [`${playerId}:${mapId}`, { player_id: playerId, map_id: mapId }]
    }).filter(Boolean),
  ),
).values()]

if (mapOwnershipRows.length) {
  const { error: mapOwnershipError } = await supabase
    .from('player_map_ownership')
    .upsert(mapOwnershipRows, { onConflict: 'player_id,map_id' })

  if (mapOwnershipError) throw mapOwnershipError
}

const teamOwnershipRows = [...new Map(
  matches.flatMap((match) => {
    const rows = []
    const p1Id = playerIdByName.get(match.player1)
    const p2Id = playerIdByName.get(match.player2)
    const t1Id = teamIdByName.get(match.teamOne)
    const t2Id = teamIdByName.get(match.teamTwo)

    if (p1Id && t1Id) rows.push([`${p1Id}:${t1Id}`, { player_id: p1Id, team_id: t1Id }])
    if (p2Id && t2Id) rows.push([`${p2Id}:${t2Id}`, { player_id: p2Id, team_id: t2Id }])

    return rows
  }),
).values()]

if (teamOwnershipRows.length) {
  const { error: teamOwnershipError } = await supabase
    .from('player_team_ownership')
    .upsert(teamOwnershipRows, { onConflict: 'player_id,team_id' })

  if (teamOwnershipError) throw teamOwnershipError
}

console.log('reference data seeded')
