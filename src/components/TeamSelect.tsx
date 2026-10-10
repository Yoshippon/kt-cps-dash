export type TeamSelectOption = {
  name: string
  faction: string | null | undefined
}

const teamFactionClasses: Record<string, string> = {
  Imperium: 'imperium',
  Chaos: 'chaos',
  Xenos: 'xenos',
  Homebrew: 'homebrew',
}

const teamFactionOrder = ['Imperium', 'Chaos', 'Xenos', 'Homebrew']

const getTeamFactionGroup = (faction: string | null | undefined) =>
  teamFactionOrder.includes(faction ?? '') ? faction! : 'Homebrew'

interface TeamSelectProps {
  value: string
  teams: TeamSelectOption[]
  onChange: (value: string) => void
  emptyLabel?: string
}

function TeamSelect({ value, teams, onChange, emptyLabel }: TeamSelectProps) {
  const groupedTeams = teams.reduce<Record<string, TeamSelectOption[]>>((groups, team) => {
    const faction = getTeamFactionGroup(team.faction)
    ;(groups[faction] ??= []).push(team)
    return groups
  }, {})
  const selectedTeam = teams.find((team) => team.name === value)
  const selectedClass = selectedTeam ? `team-select-${teamFactionClasses[getTeamFactionGroup(selectedTeam.faction)]}` : ''

  return (
    <select className={`team-select ${selectedClass}`} value={value} onChange={(event) => onChange(event.target.value)}>
      {emptyLabel && <option value="">{emptyLabel}</option>}
      {value && !selectedTeam && <option value={value}>{value}</option>}
      {teamFactionOrder.map((faction) => {
        const options = groupedTeams[faction] ?? []
        const factionClass = `team-select-${teamFactionClasses[faction]}`
        return options.length > 0 && <optgroup key={faction} className={factionClass} label={faction}>{options.map((team) => <option className={factionClass} key={team.name} value={team.name}>{team.name}</option>)}</optgroup>
      })}
    </select>
  )
}

export default TeamSelect
