import fs from 'node:fs'

const filePath = './src/data.ts'
const content = fs.readFileSync(filePath, 'utf8')

const startMarker = 'const FALLBACK_MATCHES: Match[] = ['
const startIdx = content.indexOf(startMarker)
if (startIdx === -1) {
  console.error('Could not find FALLBACK_MATCHES start')
  process.exit(1)
}

const arrayStart = startIdx + startMarker.length
let bracketCount = 1
let endIdx = arrayStart
for (let i = arrayStart; i < content.length; i++) {
  if (content[i] === '[') bracketCount++
  else if (content[i] === ']') {
    bracketCount--
    if (bracketCount === 0) {
      endIdx = i
      break
    }
  }
}

const arrayContent = content.slice(arrayStart, endIdx)
// Split by lines, keep empty lines and commas
const lines = arrayContent.split('\n')
let matchIndex = 0
const newLines = lines.map(line => {
  const trimmed = line.trim()
  if (trimmed.startsWith('{')) {
    matchIndex++
    // Add matchId at the beginning, preserve trailing comma
    const hasComma = trimmed.endsWith(',')
    const base = line.replace(/^{/, `{ "matchId": "match-${matchIndex}", `)
    return hasComma ? base : base + ','
  }
  return line
})

const newArrayContent = newLines.join('\n')
const newContent = content.slice(0, arrayStart) + newArrayContent + content.slice(endIdx)

fs.writeFileSync(filePath, newContent)
console.log(`Added matchId to ${matchIndex} FALLBACK_MATCHES entries`)