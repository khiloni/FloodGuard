import {
  Megaphone, DoorOpen, Ship, HeartHandshake, School, BrickWall, MessageCircle, Hourglass,
  LifeBuoy, Package, Droplets, Stethoscope, Zap, Construction, ClipboardCheck, House,
  Truck, Grid2x2, Timer, Anchor, type LucideIcon,
} from 'lucide-react';
import type { Action, Phase } from '../api/types';
import { N_, tr } from './i18n';

export type ParamKind = 'zone' | 'transport' | 'sandbags' | 'npc' | 'shelter';
export type Availability = 'flood' | 'recovery' | 'any';

export interface ActionMeta {
  name: string;
  label: string;
  short: string;
  icon: LucideIcon;
  group: 'move' | 'protect' | 'recover' | 'other';
  availability: Availability;
  mechanic?: string;   // only shown in scenarios with this mechanic
  params: ParamKind[];
  help: string;
}

// Display metadata only. Whether an action is allowed is decided by the API; the
// availability field just greys out buttons and explains why.
export const ACTIONS: ActionMeta[] = [
  { name: 'issue_warning', label: N_('Issue warning'), short: N_('Warn'), icon: Megaphone, group: 'move', availability: 'flood', params: [],
    help: N_('Broadcast a flood warning to every ward. Warned residents are more willing to leave.') },
  { name: 'order_evacuation', label: N_('Order evacuation'), short: N_('Evacuate'), icon: DoorOpen, group: 'move', availability: 'flood', params: ['zone'],
    help: N_('Order everyone in one ward to leave for the shelter.') },
  { name: 'assign_transport', label: N_('Send boats or trucks'), short: N_('Transport'), icon: Ship, group: 'move', availability: 'flood', params: ['zone', 'transport'],
    help: N_('Send boats or trucks to carry people from a ward. Trucks cannot use flooded roads.') },
  { name: 'prioritize_vulnerable', label: N_('Prioritise vulnerable people'), short: N_('Vulnerable'), icon: HeartHandshake, group: 'move', availability: 'flood', params: ['zone'],
    help: N_('Move elderly people, children and people with disabilities first.') },
  { name: 'open_shelter', label: N_('Open a shelter'), short: N_('Shelter'), icon: School, group: 'move', availability: 'any', params: ['shelter'],
    help: N_('Open the school on high ground so evacuees have somewhere to go.') },
  { name: 'reinforce_embankment', label: N_('Reinforce embankment'), short: N_('Sandbags'), icon: BrickWall, group: 'protect', availability: 'flood', params: ['sandbags'],
    help: N_('Lay sandbags to raise the river bund before the peak.') },
  { name: 'distribute_supplies', label: N_('Send relief supplies'), short: N_('Supplies'), icon: Package, group: 'protect', availability: 'any', params: [],
    help: N_('Deliver food and essentials to the open shelter.') },
  { name: 'request_external_support', label: N_('Request outside support'), short: N_('Support'), icon: Truck, group: 'protect', availability: 'any', params: [],
    help: N_('Ask the district for a convoy of boats, trucks, sandbags and relief. It arrives after a delay and can be requested once.') },
  { name: 'clear_drains', label: N_('Clear blocked drains'), short: N_('Drains'), icon: Grid2x2, group: 'protect', availability: 'flood', params: ['zone'], mechanic: 'drains',
    help: N_('Send a municipal crew to clear blocked drains in one area so rainwater can run off.') },
  { name: 'request_staggered_release', label: N_('Ask for a slower dam release'), short: N_('Dam'), icon: Timer, group: 'protect', availability: 'flood', params: [], mechanic: 'dam_release',
    help: N_('Ask the dam authority to release water more slowly over a longer time. Only possible before the release starts.') },
  { name: 'recall_fishing_boats', label: N_('Recall fishing boats'), short: N_('Recall'), icon: Anchor, group: 'move', availability: 'flood', params: [], mechanic: 'cyclone',
    help: N_('Radio the fishing fleet to come home. Boats need a few ticks to reach the harbour before landfall.') },
  { name: 'search_and_rescue', label: N_('Search and rescue'), short: N_('Rescue'), icon: LifeBuoy, group: 'recover', availability: 'recovery', params: ['zone'],
    help: N_('Send teams to bring stranded residents of a flooded ward to the shelter.') },
  { name: 'provide_clean_water', label: N_('Provide clean water'), short: N_('Water'), icon: Droplets, group: 'recover', availability: 'recovery', params: [],
    help: N_('Set up a water purification point to cut the risk of waterborne illness.') },
  { name: 'run_medical_camp', label: N_('Run a medical camp'), short: N_('Medical'), icon: Stethoscope, group: 'recover', availability: 'recovery', params: [],
    help: N_('Open a medical camp to check residents and treat illness.') },
  { name: 'clear_roads', label: N_('Clear a road'), short: N_('Roads'), icon: Construction, group: 'recover', availability: 'recovery', params: ['zone'],
    help: N_('Clear debris from a ward road once the water there is shallow.') },
  { name: 'restore_power', label: N_('Restore power'), short: N_('Power'), icon: Zap, group: 'recover', availability: 'recovery', params: [],
    help: N_('Repair the substation. Crews need at least one cleared road.') },
  { name: 'damage_survey', label: N_('Survey damage'), short: N_('Survey'), icon: ClipboardCheck, group: 'recover', availability: 'recovery', params: ['zone'],
    help: N_('Check houses in a flooded ward before anyone moves back.') },
  { name: 'return_residents', label: N_('Return residents home'), short: N_('Return'), icon: House, group: 'recover', availability: 'recovery', params: ['zone'],
    help: N_('Bring residents home once their ward is dry, surveyed and its road is open.') },
  { name: 'consult_npc', label: N_('Talk to a character'), short: N_('Talk'), icon: MessageCircle, group: 'other', availability: 'any', params: ['npc'],
    help: N_('Ask the village head, rescue worker or a resident for their view.') },
  { name: 'wait', label: N_('Wait and observe'), short: N_('Wait'), icon: Hourglass, group: 'other', availability: 'any', params: [],
    help: N_('Let 30 minutes pass without a new order.') },
];

export const ACTION_BY_NAME: Record<string, ActionMeta> = Object.fromEntries(ACTIONS.map((a) => [a.name, a]));

export const GROUP_LABELS: Record<ActionMeta['group'], string> = {
  move: N_('Warn and move people'),
  protect: N_('Protect and supply'),
  recover: N_('Recover (after the flood)'),
  other: N_('Talk or wait'),
};

export function actionsFor(mechanic: string | undefined): ActionMeta[] {
  return ACTIONS.filter((a) => !a.mechanic || a.mechanic === mechanic);
}

export function isAvailable(meta: ActionMeta, phase: Phase): boolean {
  if (meta.availability === 'any') return true;
  if (meta.availability === 'recovery') return phase === 'recovery';
  return phase !== 'recovery';
}

export function unavailableReason(meta: ActionMeta): string {
  return meta.availability === 'recovery'
    ? tr('Available after the flood, once the water drops below the danger level.')
    : tr('The flood response is over; use the recovery actions.');
}

export type NpcMap = Record<string, { name: string; role: string; zone: string }>;

/** Fallback roster (river village); the scenario pack's own NPCs replace it at runtime. */
export const NPCS: NpcMap = {
  village_head: { name: 'Sarpanch Ramesh', role: 'Village head', zone: 'ward-2' },
  rescue_worker: { name: 'Officer Sunita', role: 'Civil defence volunteer', zone: 'ward-1' },
  family_member: { name: 'Mohan', role: 'Ward 1 resident', zone: 'ward-1' },
  health_worker: { name: 'Nurse Kavita', role: 'Health worker', zone: 'ward-2' },
  district_official: { name: 'Ms. Desai', role: 'District official', zone: 'school' },
};

let activeNpcs: NpcMap = NPCS;
export function setActiveNpcs(list: { id: string; name: string; role: string; location?: string | null }[]) {
  activeNpcs = list.length ? Object.fromEntries(list.map((n) => [n.id, { name: n.name, role: n.role, zone: n.location || '' }])) : NPCS;
}
export function npcs(): NpcMap { return activeNpcs; }

export function describeAction(a: Action, zoneNames: Record<string, string> = {}): string {
  const meta = ACTION_BY_NAME[a.name];
  const base = meta ? tr(meta.label) : a.name.replace(/_/g, ' ');
  const p = a.params || {};
  const bits: string[] = [];
  if (typeof p.zone === 'string') bits.push(zoneNames[p.zone] || p.zone);
  if (p.transport_type) bits.push(`${p.count ?? 1} ${p.transport_type === 'boat' ? tr('boat(s)') : tr('truck(s)')}`);
  if (p.sandbags) bits.push(`${p.sandbags} ${tr('sandbags')}`);
  if (typeof p.npc_id === 'string') bits.push(activeNpcs[p.npc_id]?.name || p.npc_id);
  if (typeof p.shelter_id === 'string' && zoneNames[p.shelter_id]) bits.push(zoneNames[p.shelter_id]);
  return bits.length ? `${base}: ${bits.join(', ')}` : base;
}
