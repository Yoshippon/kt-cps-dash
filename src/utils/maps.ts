export const MAP_ORDER = [
  'Octarius',
  'Chalnath',
  'Nachmund',
  'Moroch',
  'Gallowdark',
  'Bheta Decima',
  'Volkus',
  'Tomb World',
  'Ipiranga X',
  'WTC',
  'Dust II',
  'Bunda Secundus',
]

const mapOrderIndex = new Map(MAP_ORDER.map((mapName, index) => [mapName, index]))

export const compareMapsByOrder = (firstMap: string, secondMap: string) =>
  (mapOrderIndex.get(firstMap) ?? Infinity) - (mapOrderIndex.get(secondMap) ?? Infinity)
  || firstMap.localeCompare(secondMap)
