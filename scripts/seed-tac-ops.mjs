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

const approvedOpsPack = { year: 2025, name: 'Approved Ops 2025' }

const tacOpArchetypes = [
  { name: 'Recon' },
  { name: 'Seek And Destroy' },
  { name: 'Security' },
  { name: 'Infiltration' },
]

const { data: pack, error: packError } = await supabase
  .from('approved_ops_packs')
  .upsert(approvedOpsPack, { onConflict: 'year' })
  .select('id')
  .single()

if (packError) throw packError

const { data: archetypes, error: archetypeError } = await supabase
  .from('tac_op_archetypes')
  .upsert(tacOpArchetypes, { onConflict: 'name' })
  .select('id, name')

if (archetypeError) throw archetypeError

const archetypeIdByName = new Map((archetypes ?? []).map((archetype) => [archetype.name, archetype.id]))

const tacOps = [
  [1, 'Recon', 'Flank'],
  [2, 'Recon', 'Retrieval'],
  [3, 'Recon', 'Scout Enemy Movement'],
  [4, 'Seek And Destroy', 'Sweep & Clear'],
  [5, 'Seek And Destroy', 'Dominate'],
  [6, 'Seek And Destroy', 'Rout'],
  [7, 'Security', 'Plant Banner'],
  [8, 'Security', 'Martyrs'],
  [9, 'Security', 'Envoy'],
  [10, 'Infiltration', 'Track Enemy'],
  [11, 'Infiltration', 'Plant Devices'],
  [12, 'Infiltration', 'Steal Intelligence'],
].map(([number, archetype, name]) => ({
  number,
  name,
  archetype_id: archetypeIdByName.get(archetype),
  approved_ops_pack_id: pack.id,
}))

if (tacOps.some((tacOp) => !tacOp.archetype_id)) {
  throw new Error('Could not resolve tactical operation archetype IDs.')
}

const { error: tacOpError } = await supabase
  .from('tac_ops')
  .upsert(tacOps, { onConflict: 'name' })

if (tacOpError) throw tacOpError

console.log(`Seeded ${tacOps.length} tac ops for ${approvedOpsPack.name}.`)
