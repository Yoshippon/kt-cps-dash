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

// Approved Ops packs each introduce new crit ops (and tac ops); more packs land yearly.
const approvedOpsPacks = [
  { year: 2024, name: 'Approved Ops 2024' },
  { year: 2025, name: 'Approved Ops 2025' },
]

const { data: packRows, error: packError } = await supabase
  .from('approved_ops_packs')
  .upsert(approvedOpsPacks, { onConflict: 'year' })
  .select('id, year')

if (packError) throw packError

const packIdByYear = new Map(packRows.map((row) => [row.year, row.id]))

// The first 3 crit ops are shared across every approved ops pack, so they aren't tied to one.
// 4-9 are the crit ops introduced in Approved Ops 2025.
const critOps = [
  { number: 1, name: 'Secure', approved_ops_pack_id: null, description: 'Shared crit op present in every approved ops pack.' },
  { number: 2, name: 'Loot', approved_ops_pack_id: null, description: 'Shared crit op present in every approved ops pack.' },
  { number: 3, name: 'Transmission', approved_ops_pack_id: null, description: 'Shared crit op present in every approved ops pack.' },
  { number: 4, name: 'Orb', approved_ops_pack_id: packIdByYear.get(2025), description: 'Approved Ops 2025 crit op.' },
  { number: 5, name: 'Stake Claim', approved_ops_pack_id: packIdByYear.get(2025), description: 'Approved Ops 2025 crit op.' },
  { number: 6, name: 'Energy Cells', approved_ops_pack_id: packIdByYear.get(2025), description: 'Approved Ops 2025 crit op.' },
  { number: 7, name: 'Download', approved_ops_pack_id: packIdByYear.get(2025), description: 'Approved Ops 2025 crit op.' },
  { number: 8, name: 'Data', approved_ops_pack_id: packIdByYear.get(2025), description: 'Approved Ops 2025 crit op.' },
  { number: 9, name: 'Reboot', approved_ops_pack_id: packIdByYear.get(2025), description: 'Approved Ops 2025 crit op.' },
]

const { error } = await supabase
  .from('crit_ops')
  .upsert(critOps, { onConflict: 'name' })

if (error) throw error

console.log(`Seeded ${approvedOpsPacks.length} approved ops packs and ${critOps.length} crit ops.`)
