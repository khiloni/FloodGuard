import {
  Megaphone, DoorOpen, Ship, HeartHandshake, School, BrickWall, MessageCircle, Hourglass,
  LifeBuoy, Package, Droplets, Stethoscope, Zap, Construction, ClipboardCheck, House,
  type LucideIcon,
} from 'lucide-react';
import type { Action, Phase } from '../api/types';

export type ParamKind = 'zone' | 'transport' | 'sandbags' | 'npc' | 'shelter';
export type Availability = 'flood' | 'recovery' | 'any';

export interface ActionMeta {
  name: string;
  label: string;
  short: string;
  icon: LucideIcon;
  group: 'move' | 'protect' | 'recover' | 'other';
  availability: Availability;
  params: ParamKind[];
  help: string;
}

// Display metadata only. Whether an action is allowed is decided by the API; the
// availability field just greys out buttons and explains why.
export const ACTIONS: ActionMeta[] = [
  { name: 'issue_warning', label: 'Issue warning', short: 'Warn', icon: Megaphone, group: 'move', availability: 'flood', params: [],
    help: 'Broadcast a flood warning to every ward. Warned residents are more willing to leave.' },
  { name: 'order_evacuation', label: 'Order evacuation', short: 'Evacuate', icon: DoorOpen, group: 'move', availability: 'flood', params: ['zone'],
    help: 'Order everyone in one ward to leave for the shelter.' },
  { name: 'assign_transport', label: 'Send boats or trucks', short: 'Transport', icon: Ship, group: 'move', availability: 'flood', params: ['zone', 'transport'],
    help: 'Send boats or trucks to carry people from a ward. Trucks cannot use flooded roads.' },
  { name: 'prioritize_vulnerable', label: 'Prioritise vulnerable people', short: 'Vulnerable', icon: HeartHandshake, group: 'move', availability: 'flood', params: ['zone'],
    help: 'Move elderly people, children and people with disabilities first.' },
  { name: 'open_shelter', label: 'Open the shelter', short: 'Shelter', icon: School, group: 'protect', availability: 'any', params: ['shelter'],
    help: 'Open the school on high ground so evacuees have somewhere to go.' },
  { name: 'reinforce_embankment', label: 'Reinforce embankment', short: 'Sandbags', icon: BrickWall, group: 'protect', availability: 'flood', params: ['sandbags'],
    help: 'Lay sandbags to raise the river bund before the peak.' },
  { name: 'distribute_supplies', label: 'Send relief supplies', short: 'Supplies', icon: Package, group: 'protect', availability: 'any', params: [],
    help: 'Deliver food and essentials to the open shelter.' },
  { name: 'search_and_rescue', label: 'Search and rescue', short: 'Rescue', icon: LifeBuoy, group: 'recover', availability: 'recovery', params: ['zone'],
    help: 'Send teams to bring stranded residents of a flooded ward to the shelter.' },
  { name: 'provide_clean_water', label: 'Provide clean water', short: 'Water', icon: Droplets, group: 'recover', availability: 'recovery', params: [],
    help: 'Set up a water purification point to cut the risk of waterborne illness.' },
  { name: 'run_medical_camp', label: 'Run a medical camp', short: 'Medical', icon: Stethoscope, group: 'recover', availability: 'recovery', params: [],
    help: 'Open a medical camp to check residents and treat illness.' },
  { name: 'clear_roads', label: 'Clear a road', short: 'Roads', icon: Construction, group: 'recover', availability: 'recovery', params: ['zone'],
    help: 'Clear debris from a ward road once the water there is shallow.' },
  { name: 'restore_power', label: 'Restore power', short: 'Power', icon: Zap, group: 'recover', availability: 'recovery', params: [],
    help: 'Repair the substation. Crews need at least one cleared road.' },
  { name: 'damage_survey', label: 'Survey damage', short: 'Survey', icon: ClipboardCheck, group: 'recover', availability: 'recovery', params: ['zone'],
    help: 'Check houses in a flooded ward before anyone moves back.' },
  { name: 'return_residents', label: 'Return residents home', short: 'Return', icon: House, group: 'recover', availability: 'recovery', params: ['zone'],
    help: 'Bring residents home once their ward is dry, surveyed and its road is open.' },
  { name: 'consult_npc', label: 'Talk to a character', short: 'Talk', icon: MessageCircle, group: 'other', availability: 'any', params: ['npc'],
    help: 'Ask the village head, rescue worker or a resident for their view.' },
  { name: 'wait', label: 'Wait and observe', short: 'Wait', icon: Hourglass, group: 'other', availability: 'any', params: [],
    help: 'Let 30 minutes pass without a new order.' },
];

export const ACTION_BY_NAME: Record<string, ActionMeta> = Object.fromEntries(ACTIONS.map((a) => [a.name, a]));

export const GROUP_LABELS: Record<ActionMeta['group'], string> = {
  move: 'Warn and move people',
  protect: 'Protect and supply',
  recover: 'Recover (after the flood)',
  other: 'Talk or wait',
};

export function isAvailable(meta: ActionMeta, phase: Phase): boolean {
  if (meta.availability === 'any') return true;
  if (meta.availability === 'recovery') return phase === 'recovery';
  return phase !== 'recovery';
}

export function unavailableReason(meta: ActionMeta): string {
  return meta.availability === 'recovery'
    ? 'Available after the flood, once the water drops below the danger level.'
    : 'The flood response is over; use the recovery actions.';
}

export const NPCS: Record<string, { name: string; role: string; zone: string }> = {
  village_head: { name: 'Sarpanch Ramesh', role: 'Village head', zone: 'ward-2' },
  rescue_worker: { name: 'Officer Sunita', role: 'Civil defence volunteer', zone: 'ward-1' },
  family_member: { name: 'Mohan', role: 'Ward 1 resident', zone: 'ward-1' },
};

export function describeAction(a: Action, zoneNames: Record<string, string> = {}): string {
  const meta = ACTION_BY_NAME[a.name];
  const base = meta ? meta.label : a.name.replace(/_/g, ' ');
  const p = a.params || {};
  const bits: string[] = [];
  if (typeof p.zone === 'string') bits.push(zoneNames[p.zone] || p.zone);
  if (p.transport_type) bits.push(`${p.count ?? 1} ${p.transport_type === 'boat' ? 'boat(s)' : 'truck(s)'}`);
  if (p.sandbags) bits.push(`${p.sandbags} sandbags`);
  if (typeof p.npc_id === 'string') bits.push(NPCS[p.npc_id]?.name || p.npc_id);
  return bits.length ? `${base}: ${bits.join(', ')}` : base;
}
