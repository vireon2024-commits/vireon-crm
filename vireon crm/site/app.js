'use strict'

const APP_VERSION = '1.0.0-final'
const SESSION_KEY = 'vireon-lead-hub-session-v1'
const STAGES = [
  ['new', 'New Lead'],
  ['contacted', 'Contacted'],
  ['requirements', 'Requirements Collected'],
  ['proposal_preparing', 'Proposal Preparing'],
  ['proposal_sent', 'Proposal Sent'],
  ['follow_up', 'Follow-up'],
  ['meeting', 'Meeting Scheduled'],
  ['negotiating', 'Negotiating'],
  ['won', 'Won'],
  ['lost', 'Lost'],
  ['on_hold', 'On Hold'],
]
const PRIORITIES = ['urgent', 'high', 'medium', 'low']
const INDUSTRIES = ['School', 'Restaurant', 'Consultancy', 'Clothing', 'Gym', 'Hotel', 'Real Estate', 'Construction', 'Healthcare', 'Technology', 'Other business', 'Other']
const SOURCES = ['Vacancy', 'Coldcall', 'Cold Call', 'Referral', 'Instagram', 'Facebook', 'Website', 'Walk-in', 'Existing Network', 'Other']
const CLIENT_STATUSES = ['active', 'paused', 'completed', 'cancelled']
const DELIVERABLE_STATUSES = ['not_started', 'in_progress', 'review', 'approved', 'delivered', 'blocked']
const SHOOT_STATUSES = ['planned', 'confirmed', 'completed', 'rescheduled', 'cancelled']
const CYCLE_STATUSES = ['planned', 'active', 'review', 'completed', 'paused']
const PAYMENT_STATUSES = ['upcoming', 'due', 'overdue', 'paid', 'waived']
const ACTIVE_LEAD_STAGES = STAGES.map(([key]) => key).filter(key => !['won', 'lost'].includes(key))

const ADMIN_NAV = [
  ['dashboard', 'Dashboard', 'grid'],
  ['leads', 'Leads', 'users'],
  ['pipeline', 'Pipeline', 'columns'],
  ['follow-ups', 'Follow-ups', 'check'],
  ['clients', 'Clients', 'briefcase'],
  ['activities', 'Activities', 'activity'],
  ['quick-replies', 'Quick Replies', 'copy'],
  ['reports', 'Reports', 'chart'],
  ['team', 'Team', 'team'],
  ['settings', 'Settings', 'settings'],
]
const MEMBER_NAV = [
  ['dashboard', 'My Dashboard', 'grid'],
  ['leads', 'My Leads', 'users'],
  ['pipeline', 'My Pipeline', 'columns'],
  ['follow-ups', 'My Follow-ups', 'check'],
  ['clients', 'My Clients', 'briefcase'],
  ['activities', 'Activities', 'activity'],
  ['quick-replies', 'Quick Replies', 'copy'],
]

const state = {
  config: null,
  session: null,
  profile: null,
  loading: true,
  loadError: '',
  online: navigator.onLine,
  menuOpen: false,
  filters: {},
  sheetPreview: null,
  leads: [],
  requirements: [],
  clients: [],
  clientFinancials: [],
  activities: [],
  tasks: [],
  cycles: [],
  deliverables: [],
  shoots: [],
  payments: [],
  quickReplies: [],
  staleRules: [],
  profiles: [],
  syncLogs: [],
  auditLogs: [],
}

const app = document.getElementById('app')
const modalRoot = document.getElementById('modal-root')
const toastRoot = document.getElementById('toast-root')

function isAdmin() { return state.profile?.role === 'admin' }
function navItems() { return isAdmin() ? ADMIN_NAV : MEMBER_NAV }
function requireAdmin() { if (!isAdmin()) throw new Error('Administrator access is required for this action.') }
function assertOnline() { if (!navigator.onLine) throw new Error('You are offline. Reconnect before saving changes.') }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(16).slice(2)}` }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '')) }
function esc(value = '') { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char])) }
function attr(value = '') { return esc(value).replace(/`/g, '&#096;') }
function safeUrl(value, assumeHttps = false) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const candidate = assumeHttps && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw
  try { const parsed = new URL(candidate); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '' } catch { return '' }
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)) }
function numOrNull(value) { return value === '' || value === null || value === undefined ? null : Number(value) }
function todayIso() { return new Date().toISOString() }
function dateOnly(value = new Date()) { const d = value instanceof Date ? value : parseDateValue(value); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '' }
function localDate(value) { if (!value) return null; if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) { const [y, m, d] = String(value).split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); } const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed }
function parseDateValue(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const text = String(value).trim()
  if (!text) return null
  let match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (match) {
    const month = Number(match[1]); const day = Number(match[2]); const year = Number(match[3])
    const d = new Date(year, month - 1, day, 12, 0, 0)
    return d.getMonth() === month - 1 && d.getDate() === day ? d : null
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return localDate(text.slice(0, 10))
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
function toDateTimeInput(value) { const d = localDate(value); if (!d) return ''; const adjusted = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return adjusted.toISOString().slice(0, 16) }
function fmtDate(value, withTime = false) { const d = localDate(value); if (!d) return '—'; const options = withTime ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', year: 'numeric' }; return new Intl.DateTimeFormat('en-GB', options).format(d) }
function fmtSheetDate(value) { const d = localDate(value); return d ? `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` : '' }
function fmtCurrency(value) { if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '—'; return `NPR ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value))}` }
function fmtNumber(value) { return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0) }
function daysBetween(a, b = new Date()) { const first = localDate(a); const second = localDate(b); if (!first || !second) return null; return Math.floor((second.getTime() - first.getTime()) / 86400000) }
function isToday(value) { const d = localDate(value); if (!d) return false; const now = new Date(); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate() }
function isPast(value) { const d = localDate(value); if (!d) return false; return d.getTime() < Date.now() && !isToday(d) }
function withinDays(value, days) { const d = localDate(value); if (!d) return false; const diff = (d.getTime() - Date.now()) / 86400000; return diff >= 0 && diff <= days }
function stageLabel(value) { return STAGES.find(([key]) => key === value)?.[1] || String(value || 'Unknown') }
function humanize(value) { return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase()) }
function initials(name) { return String(name || 'V').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'V' }
function normalizeText(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function normalizePhone(value) { return String(value || '').replace(/\D/g, '').replace(/^977/, '') }
function normalizeEmail(value) { return String(value || '').trim().toLowerCase() }
function profileName(id) { return state.profiles.find(profile => profile.id === id)?.full_name || 'Unassigned' }
function route() { const raw = (location.hash || '#/dashboard').replace(/^#\/?/, ''); const [path, query = ''] = raw.split('?'); const parts = path.split('/').filter(Boolean); return { page: parts[0] || 'dashboard', id: parts[1] || null, query: new URLSearchParams(query) } }
function pageTitle(page) { return navItems().find(([key]) => key === page)?.[1] || 'Vireon Lead Hub' }
function greeting() { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening' }
function optionList(items, selected, labels = {}) { return items.map(item => { const key = Array.isArray(item) ? item[0] : item; const label = Array.isArray(item) ? item[1] : labels[key] || humanize(key); return `<option value="${attr(key)}" ${String(key) === String(selected || '') ? 'selected' : ''}>${esc(label)}</option>` }).join('') }
function checked(value) { return value ? 'checked' : '' }
function selectedCycle(clientId) { const cycles = state.cycles.filter(cycle => cycle.client_id === clientId).sort((a, b) => String(b.period_start).localeCompare(String(a.period_start))); const stored = state.filters.cycle?.[clientId]; return cycles.find(cycle => cycle.id === stored) || cycles.find(cycle => cycle.status === 'active') || cycles[0] || null }
function financialFor(clientId) { return state.clientFinancials.find(financial => financial.client_id === clientId) || null }
function leadForClient(client) { return state.leads.find(lead => lead.id === client.lead_id) || null }
function requirementFor(leadId) { return state.requirements.find(requirement => requirement.lead_id === leadId) || null }
function activeTask(task) { return task.status === 'pending' }
function dueTask(task) { return activeTask(task) && task.due_at && (isToday(task.due_at) || isPast(task.due_at)) }
function leadFollowupText(lead) { return lead.next_follow_up_at ? fmtDate(lead.next_follow_up_at, true) : (lead.next_follow_up_note || 'Not scheduled') }
function countCompleted(deliverables) { return deliverables.reduce((sum, item) => sum + Number(item.completed_quantity || 0), 0) }
function countPromised(deliverables) { return deliverables.reduce((sum, item) => sum + Number(item.quantity || 0), 0) }
async function copyText(value) {
  const text = String(value || '')
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const copied = document.execCommand?.('copy')
  area.remove()
  if (!copied) throw new Error('Copy is unavailable in this browser.')
}
function canManageClient(clientId) {
  if (isAdmin()) return true
  const client = state.clients.find(item => item.id === clientId)
  const lead = client ? leadForClient(client) : null
  return client?.account_manager === state.profile?.id || lead?.assigned_to === state.profile?.id
}
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
function downloadCsv(filename, headers, rows) {
  const content = '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove()
  URL.revokeObjectURL(url)
}
function exportLeadsCsv() {
  requireAdmin()
  const headers = ['Lead Name','Contact Number','Email','Business Type','Lead Source','Date First Contacted','Current Situation / Remarks','Lead Status','Priority','Next Follow-up Date','Expected Monthly Value','Score','Owner','CRM ID']
  const rows = state.leads.map(lead => [lead.company_name, lead.phone, lead.email, lead.industry, lead.lead_source, fmtSheetDate(lead.date_first_contacted), lead.remarks, sheetStatusForStage(lead.stage), humanize(lead.priority), lead.next_follow_up_at ? fmtSheetDate(lead.next_follow_up_at) : lead.next_follow_up_note, lead.expected_monthly_value, lead.score || calculateScore(lead).total, profileName(lead.assigned_to), lead.id])
  downloadCsv(`vireon-leads-${dateOnly()}.csv`, headers, rows)
}
function exportClientsCsv() {
  requireAdmin()
  const headers = ['Client','Status','Package','Monthly Fee','Billing Cycle','Contract Start','Contract End','Renewal Date','Account Manager','Phone','Email','Services']
  const rows = state.clients.map(client => { const fin = financialFor(client.id); return [client.company_name, humanize(client.status), client.package_name, fin?.monthly_fee || 0, humanize(fin?.billing_cycle || 'monthly'), client.contract_start, client.contract_end, client.renewal_date, profileName(client.account_manager), client.phone, client.email, (client.services || []).join('; ')] })
  downloadCsv(`vireon-clients-${dateOnly()}.csv`, headers, rows)
}

function icon(name, size = 17) {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    columns: '<rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
    activity: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/>',
    team: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M19 8v6M22 11h-6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09a1.7 1.7 0 0 0-1.1-1.58 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.67 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.67a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.37.35.7.6 1 .28.3.67.48 1.1.5H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92Z"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    alert: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01"/>',
    upload: '<path d="M12 3v12M7 8l5-5 5 5M5 21h14"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`
}

function toast(title, message = '', type = 'success') {
  const id = uid()
  if (!toastRoot.querySelector('.toast-stack')) toastRoot.innerHTML = '<div class="toast-stack"></div>'
  const stack = toastRoot.querySelector('.toast-stack')
  stack.insertAdjacentHTML('afterbegin', `<div class="toast ${type === 'error' ? 'error' : ''}" data-toast="${id}"><strong>${esc(title)}</strong>${message ? `<p>${esc(message)}</p>` : ''}</div>`)
  setTimeout(() => stack.querySelector(`[data-toast="${id}"]`)?.remove(), 3600)
}

function badgeStage(stage) { return `<span class="badge stage-${attr(stage)}">${esc(stageLabel(stage))}</span>` }
function badgePriority(priority) { return `<span class="badge priority-${attr(priority || 'medium')}">${esc(priority || 'medium')}</span>` }
function badgeStatus(status) { return `<span class="badge badge-${['active', 'completed', 'paid', 'delivered', 'approved', 'won', 'confirmed'].includes(status) ? 'blue' : ['cancelled', 'lost', 'blocked', 'overdue'].includes(status) ? 'dark' : 'soft'}">${esc(humanize(status))}</span>` }
function scoreClass(score) { return Number(score) >= 75 ? 'hot' : Number(score) >= 45 ? 'warm' : 'cold' }
function badgeScore(score) { return `<span class="score ${scoreClass(score)}">${Number(score) || 0}</span>` }

function calculateScore(lead) {
  const budget = Number(lead.estimated_budget || lead.expected_monthly_value || 0)
  const budgetScore = budget >= 50000 ? 18 : budget >= 30000 ? 15 : budget >= 20000 ? 12 : budget >= 10000 ? 8 : budget > 0 ? 4 : 0
  const engagement = clamp(lead.engagement_level || 2, 0, 5) * 3
  const decision = lead.decision_maker_contacted ? 10 : 0
  const meeting = clamp(lead.meeting_interest, 0, 5) * 2
  const urgency = clamp(lead.urgency_level, 0, 5) * 2
  const completeness = Math.round(clamp(lead.requirements_completeness, 0, 100) * .15)
  const stageScores = { new: 0, contacted: 3, requirements: 7, proposal_preparing: 10, proposal_sent: 13, follow_up: 11, meeting: 14, negotiating: 18, won: 20, lost: 0, on_hold: 2 }
  const stage = stageScores[lead.stage] || 0
  const inactiveDays = Math.max(0, daysBetween(lead.last_activity_at || lead.updated_at || lead.created_at) || 0)
  const freshness = inactiveDays <= 1 ? 9 : inactiveDays <= 3 ? 7 : inactiveDays <= 7 ? 4 : inactiveDays <= 10 ? 2 : 0
  const calculated = clamp(budgetScore + engagement + decision + meeting + urgency + completeness + stage + freshness, 0, 100)
  const total = lead.score_override !== null && lead.score_override !== undefined ? Number(lead.score_override) : calculated
  return {
    total,
    factors: [
      ['Budget / value', budgetScore, 18],
      ['Engagement', engagement, 15],
      ['Decision-maker', decision, 10],
      ['Meeting interest', meeting, 10],
      ['Urgency', urgency, 10],
      ['Requirements', completeness, 15],
      ['Stage progress', stage, 20],
      ['Recent activity', freshness, 9],
    ],
  }
}

function staleResult(lead) {
  if (['won', 'lost'].includes(lead.stage)) return { stale: false }
  if (lead.next_follow_up_at && isPast(lead.next_follow_up_at)) return { stale: true, reason: 'Follow-up is overdue', suggestion: 'Contact the lead and record the result.' }
  const days = Math.max(0, daysBetween(lead.last_activity_at || lead.updated_at || lead.created_at) || 0)
  const note = `${lead.remarks || ''} ${lead.next_follow_up_note || ''}`.toLowerCase()
  if (lead.stage === 'proposal_sent' && days >= 5) return { stale: true, reason: 'Proposal has had no activity for 5+ days', suggestion: 'Send a concise proposal follow-up.' }
  if ((note.includes('waiting') || note.includes('review')) && days >= 5) return { stale: true, reason: 'Waiting/reviewing without a recent update', suggestion: 'Ask whether revisions or clarification are needed.' }
  if (lead.stage === 'requirements' && days >= 2) return { stale: true, reason: 'Requirements are collected but proposal work has not progressed', suggestion: 'Start the proposal and assign an owner.' }
  if (days >= 10) return { stale: true, reason: 'No activity for 10+ days', suggestion: 'Contact the lead or move it to On Hold/Lost.' }
  return { stale: false }
}

function findDuplicates(candidate, list = state.leads) {
  return list.map(lead => {
    const reasons = []; let confidence = 0
    if (candidate.company_name && normalizeText(candidate.company_name) === normalizeText(lead.company_name)) { reasons.push('same company'); confidence += 35 }
    if (normalizePhone(candidate.phone) && normalizePhone(candidate.phone) === normalizePhone(lead.phone)) { reasons.push('same phone'); confidence += 60 }
    if (normalizeEmail(candidate.email) && normalizeEmail(candidate.email) === normalizeEmail(lead.email)) { reasons.push('same email'); confidence += 65 }
    return { lead, reasons, confidence: Math.min(confidence, 100) }
  }).filter(match => match.reasons.length).sort((a, b) => b.confidence - a.confidence)
}

function smartParse(text) {
  const lower = String(text || '').toLowerCase()
  const numberMatch = regex => { const match = lower.match(regex); return match ? Number(match[1].replace(/,/g, '')) : null }
  const budget = numberMatch(/(?:budget|rs\.?|npr|रु)\s*(?:is|around|approx(?:imately)?|of)?\s*([0-9,]+)/i) || numberMatch(/([0-9,]+)\s*(?:budget|rs|npr)/i)
  const videos = numberMatch(/([0-9]+)\s*(?:-|to)?\s*(?:[0-9]+\s*)?(?:videos?|reels?)\s*(?:monthly|per month|a month)/i)
  const graphics = numberMatch(/([0-9]+)\s*(?:graphics?|posts?|banners?)\s*(?:monthly|per month|a month)/i)
  let stage = ''
  if (/proposal sent|sent.*proposal/.test(lower)) stage = 'proposal_sent'
  else if (/send.*proposal|proposal.*send/.test(lower)) stage = 'proposal_preparing'
  else if (/schedule.*meeting|set up.*meeting|setup.*meeting/.test(lower)) stage = 'meeting'
  else if (/no reply|waiting for reply|follow.?up|reviewing/.test(lower)) stage = 'follow_up'
  if (/not interested|no deal|rejected/.test(lower)) stage = 'lost'
  if (/confirmed|signed|deal done|client onboarded/.test(lower)) stage = 'won'
  return { budget, videos, graphics, stage, cleaned: String(text || '').trim().replace(/\s+/g, ' ') }
}

async function loadConfig() {
  try {
    const response = await fetch('/api/public-config', { cache: 'no-store' })
    state.config = await response.json()
  } catch {
    state.config = { supabaseUrl: '', supabasePublishableKey: '', sheetsConfigured: false, teamAdminConfigured: false }
  }
}

async function authRequest(path, options = {}) {
  const { supabaseUrl, supabasePublishableKey } = state.config
  return fetch(`${supabaseUrl}/auth/v1/${path}`, {
    ...options,
    headers: { apikey: supabasePublishableKey, 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
}

async function refreshSession() {
  if (!state.session?.refresh_token) throw new Error('Session expired. Sign in again.')
  const response = await authRequest('token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: state.session.refresh_token }) })
  if (!response.ok) { await logout(false); throw new Error('Session expired. Sign in again.') }
  state.session = await response.json()
  localStorage.setItem(SESSION_KEY, JSON.stringify(state.session))
}

async function restRequest(table, query = '', options = {}) {
  if (!state.session?.access_token) throw new Error('Please sign in again.')
  const { supabaseUrl, supabasePublishableKey } = state.config
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, {
    ...options,
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${state.session.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  })
  if (response.status === 401 && state.session.refresh_token && !options._retried) {
    await refreshSession()
    return restRequest(table, query, { ...options, _retried: true })
  }
  if (!response.ok) {
    let message = `Database request failed (${response.status}).`
    try { const body = await response.json(); message = body.message || body.hint || body.error || message } catch {}
    if (/does not exist|schema cache/i.test(message)) message += ' Run supabase/FINAL_SETUP.sql and refresh.'
    throw new Error(message)
  }
  if (response.status === 204) return []
  const text = await response.text()
  return text ? JSON.parse(text) : []
}

async function insertRecord(table, record, query = '') {
  assertOnline()
  const rows = await restRequest(table, query, { method: 'POST', body: JSON.stringify(record) })
  return rows[0]
}
async function updateRecord(table, id, changes) {
  assertOnline()
  const rows = await restRequest(table, `?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(changes) })
  return rows[0]
}
async function deleteRecord(table, id) {
  assertOnline()
  await restRequest(table, `?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
}
async function upsertRecord(table, record, conflict) {
  assertOnline()
  const rows = await restRequest(table, `?on_conflict=${encodeURIComponent(conflict)}`, { method: 'POST', body: JSON.stringify(record), headers: { Prefer: 'resolution=merge-duplicates,return=representation' } })
  return rows[0]
}

async function login(email, password) {
  const response = await authRequest('token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) })
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error_description || body.msg || body.message || 'Invalid email or password.') }
  state.session = await response.json()
  localStorage.setItem(SESSION_KEY, JSON.stringify(state.session))
  await loadAll()
}

async function logout(render = true) {
  if (state.session?.access_token) await authRequest('logout', { method: 'POST', headers: { Authorization: `Bearer ${state.session.access_token}` } }).catch(() => {})
  state.session = null
  state.profile = null
  localStorage.removeItem(SESSION_KEY)
  if (render) { location.hash = '#/login'; renderApp() }
}

async function loadAll() {
  state.loading = true
  state.loadError = ''
  renderApp()
  if (!state.session) {
    try { state.session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { state.session = null }
  }
  if (!state.session) { state.loading = false; return }

  try {
    const profiles = await restRequest('profiles', '?select=*&order=full_name.asc')
    const profile = profiles.find(item => item.id === state.session.user.id)
    if (!profile) throw new Error('Your profile is missing. Run FINAL_SETUP.sql in Supabase.')
    if (profile.is_active === false) { await logout(false); throw new Error('Your Vireon account is inactive. Contact an administrator.') }
    state.profile = profile
    state.profiles = profiles

    const commonRequests = [
      restRequest('leads', '?select=*&order=updated_at.desc'),
      restRequest('lead_requirements', '?select=*'),
      restRequest('clients', '?select=*&order=updated_at.desc'),
      restRequest('activities', '?select=*&order=created_at.desc&limit=500'),
      restRequest('tasks', '?select=*&order=due_at.asc.nullslast'),
      restRequest('client_cycles', '?select=*&order=period_start.desc'),
      restRequest('deliverables', '?select=*&order=due_date.asc.nullslast'),
      restRequest('shoots', '?select=*&order=scheduled_at.asc'),
      restRequest('quick_replies', '?select=*&order=is_favorite.desc,usage_count.desc,created_at.desc'),
      restRequest('stale_rules', '?select=*&order=inactivity_days.asc'),
    ]
    const [leads, requirements, clients, activities, tasks, cycles, deliverables, shoots, quickReplies, staleRules] = await Promise.all(commonRequests)
    Object.assign(state, { leads, requirements, clients, activities, tasks, cycles, deliverables, shoots, quickReplies, staleRules })

    if (isAdmin()) {
      const [clientFinancials, payments, syncLogs, auditLogs] = await Promise.all([
        restRequest('client_financials', '?select=*'),
        restRequest('payments', '?select=*&order=due_date.asc.nullslast'),
        restRequest('sync_logs', '?select=*&order=created_at.desc&limit=30'),
        restRequest('audit_logs', '?select=*&order=created_at.desc&limit=100'),
      ])
      Object.assign(state, { clientFinancials, payments, syncLogs, auditLogs })
    } else {
      Object.assign(state, { clientFinancials: [], payments: [], syncLogs: [], auditLogs: [] })
    }
  } catch (error) {
    state.loadError = error.message || 'Could not load the workspace.'
  }
  state.loading = false
}

async function refreshAndRender(message) {
  await loadAll()
  renderApp()
  if (message) toast(message)
}

function renderApp() {
  if (state.loading) { app.innerHTML = '<div class="boot"><div class="boot-wordmark">VIREON</div><div class="boot-line"></div><p>Opening secure workspace…</p></div>'; return }
  if (!state.config?.supabaseUrl || !state.config?.supabasePublishableKey) { renderSetup(); return }
  if (!state.session) { renderLogin(); return }
  if (state.loadError) { renderLoadError(); return }

  const current = route()
  const allowedPages = navItems().map(([page]) => page)
  if (!allowedPages.includes(current.page)) { location.hash = '#/dashboard'; return }
  const content = renderPage(current)
  app.innerHTML = shellHtml(current.page, content)
  bindPipeline()
}

function renderSetup() {
  app.innerHTML = `<main class="setup-page"><section class="setup-card"><p class="eyebrow">VIREON LEAD HUB</p><h1>One final setup is required.</h1><p>The app is deployed, but Netlify does not yet have the Supabase environment variables. No demo records are shown and nothing is saved only in this browser.</p><div class="setup-list"><div><p>Run <strong>supabase/FINAL_SETUP.sql</strong> in Supabase SQL Editor.</p></div><div><p>Add <strong>SUPABASE_URL</strong> and <strong>SUPABASE_PUBLISHABLE_KEY</strong> in Netlify environment variables.</p></div><div><p>Create your personal login, then run <strong>supabase/MAKE_ADMIN.sql</strong> so exactly one account is the Administrator.</p></div></div><button class="btn btn-primary" data-action="reload">Check configuration again</button></section></main>`
}

function renderLoadError() {
  app.innerHTML = `<main class="setup-page"><section class="setup-card"><p class="eyebrow">DATABASE CHECK</p><h1>The workspace needs the final database upgrade.</h1><p>${esc(state.loadError)}</p><div class="setup-list"><div><p>Open Supabase → SQL Editor.</p></div><div><p>Run the complete file <strong>supabase/FINAL_SETUP.sql</strong>.</p></div><div><p>Return here and reload.</p></div></div><div class="page-heading-actions"><button class="btn btn-primary" data-action="reload">Reload</button><button class="btn btn-secondary" data-direct-logout>Sign out</button></div></section></main>`
  app.querySelector('[data-direct-logout]')?.addEventListener('click', () => logout())
}

function renderLogin() {
  app.innerHTML = `<main class="auth-page"><section class="auth-brand"><div class="auth-wordmark"><strong>VIREON</strong><span>IDEAS MADE VISIBLE</span></div><div class="auth-copy"><p class="eyebrow">PRIVATE TEAM WORKSPACE</p><h1>Every lead.<br>Every promise.<br>One clear system.</h1><p>Track conversations, proposals, follow-ups, signed clients, shoots, deliverables and payments without losing context between the team.</p><div class="auth-feature-row"><span>Real Google Sheets data</span><span>Admin and staff access</span><span>Client delivery tracking</span></div></div><small>Vireon Lead Hub · ${APP_VERSION}</small></section><section class="auth-panel"><form id="login-form" class="auth-card"><p class="eyebrow">SECURE SIGN IN</p><h2>Welcome back</h2><p>Use the account created by the Vireon administrator.</p><div id="login-error" class="auth-error"></div><div class="form"><label><span>Email address</span><input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label><label><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label><button class="btn btn-primary btn-full" type="submit">Sign in</button></div><div class="security-note">There is no public signup. Your approved personal account is the Administrator; accounts created for the team start as Team Members.</div></form></section></main>`
}

function shellHtml(page, content) {
  return `<div class="shell ${state.menuOpen ? 'menu-open' : ''}" id="shell"><aside class="sidebar"><div class="side-brand"><div class="wordmark"><strong>VIREON</strong><span>IDEAS MADE VISIBLE</span></div><button class="icon-btn mobile-close" data-action="menu-close" aria-label="Close menu">${icon('close')}</button></div><div class="side-product"><div class="side-product-mark">V</div><div><strong>Lead Hub</strong><small>Sales + client delivery</small></div></div><nav class="side-nav">${navItems().map(([key, label, iconName]) => `<a href="#/${key}" class="${key === page ? 'active' : ''}" data-nav><span class="nav-icon">${icon(iconName)}</span><span>${esc(label)}</span></a>`).join('')}</nav><div class="sidebar-footer"><div class="user-card"><div class="user-avatar">${esc(initials(state.profile.full_name))}</div><div><strong>${esc(state.profile.full_name)}</strong><small>${esc(state.profile.role === 'admin' ? 'Administrator' : (state.profile.job_title || 'Team Member'))}</small></div></div><button class="side-logout" data-action="logout">${icon('logout')}<span>Sign out</span></button></div></aside><div class="sidebar-scrim" data-action="menu-close"></div><main class="main"><header class="topbar"><div class="topbar-actions"><button class="icon-btn mobile-menu" data-action="menu-open" aria-label="Open menu">${icon('menu')}</button><div class="topbar-title"><p class="eyebrow">VIREON LEAD HUB</p><h1>${esc(pageTitle(page))}</h1></div></div><div class="topbar-actions"><div class="connection-pill ${state.online ? '' : 'offline'}"><i></i><span>${state.online ? 'Cloud connected' : 'Offline — read only'}</span></div><button class="icon-btn" data-action="password-change" title="Change password">${icon('lock')}</button></div></header><div class="page">${content}</div></main></div>`
}

function pageHeading(title, subtitle, actions = '') { return `<div class="page-heading"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><div class="page-heading-actions">${actions}</div></div>` }
function metric(label, value, note) { return `<article class="metric"><span class="metric-label">${esc(label)}</span><strong data-count="${attr(String(value).replace(/[^0-9.-]/g, ''))}">${value}</strong><small>${esc(note)}</small></article>` }
function panel(title, subtitle, body, action = '') { return `<section class="panel"><div class="panel-header"><div><p class="eyebrow">VIREON</p><h3>${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>${action}</div>${body}</section>` }
function emptyState(title, copy) { return `<div class="empty">${icon('check', 25)}<strong>${esc(title)}</strong><p>${esc(copy)}</p></div>` }

function renderPage(current) {
  switch (current.page) {
    case 'dashboard': return dashboardHtml()
    case 'leads': return current.id ? leadDetailHtml(current.id) : leadsHtml()
    case 'pipeline': return pipelineHtml()
    case 'follow-ups': return followupsHtml()
    case 'clients': return current.id ? clientDetailHtml(current.id) : clientsHtml()
    case 'activities': return activitiesHtml()
    case 'quick-replies': return quickRepliesHtml()
    case 'reports': return reportsHtml()
    case 'team': return teamHtml()
    case 'settings': return settingsHtml()
    default: return dashboardHtml()
  }
}

function dashboardHtml() { return isAdmin() ? adminDashboardHtml() : memberDashboardHtml() }

function adminDashboardHtml() {
  const todayFollowups = state.leads.filter(lead => ACTIVE_LEAD_STAGES.includes(lead.stage) && lead.next_follow_up_at && isToday(lead.next_follow_up_at))
  const overdueFollowups = state.leads.filter(lead => ACTIVE_LEAD_STAGES.includes(lead.stage) && lead.next_follow_up_at && isPast(lead.next_follow_up_at))
  const stale = state.leads.filter(lead => staleResult(lead).stale)
  const proposals = state.leads.filter(lead => ['proposal_preparing', 'proposal_sent'].includes(lead.stage))
  const negotiating = state.leads.filter(lead => lead.stage === 'negotiating')
  const activeClients = state.clients.filter(client => client.status === 'active')
  const mrr = state.clientFinancials.filter(fin => activeClients.some(client => client.id === fin.client_id) && fin.billing_cycle === 'monthly').reduce((sum, fin) => sum + Number(fin.monthly_fee || 0), 0)
  const openWork = state.deliverables.filter(item => !['delivered', 'approved'].includes(item.status))
  const upcomingShoots = state.shoots.filter(shoot => ['planned', 'confirmed', 'rescheduled'].includes(shoot.status) && !isPast(shoot.scheduled_at)).slice(0, 6)
  const attention = [...overdueFollowups.map(lead => ({ lead, reason: 'Follow-up overdue', when: leadFollowupText(lead) })), ...stale.filter(lead => !overdueFollowups.some(item => item.id === lead.id)).map(lead => ({ lead, reason: staleResult(lead).reason, when: `${daysBetween(lead.last_activity_at || lead.updated_at || lead.created_at) || 0} days inactive` }))].slice(0, 8)
  const maxStage = Math.max(1, ...STAGES.map(([stage]) => state.leads.filter(lead => lead.stage === stage).length))
  const workload = state.profiles.filter(profile => profile.is_active !== false).map(profile => ({ profile, leads: state.leads.filter(lead => lead.assigned_to === profile.id && ACTIVE_LEAD_STAGES.includes(lead.stage)).length, tasks: state.tasks.filter(task => task.assigned_to === profile.id && activeTask(task)).length, work: state.deliverables.filter(item => item.assigned_to === profile.id && !['delivered', 'approved'].includes(item.status)).length }))
  return `${pageHeading(greeting() + ', ' + (state.profile.full_name?.split(' ')[0] || 'Admin'), 'Here is the live position of Vireon’s leads, clients and delivery workload.', `<button class="btn btn-secondary" data-action="task-add">${icon('check')} Add task</button><button class="btn btn-primary" data-action="lead-add">${icon('plus')} Add lead</button>`)}<section class="metrics">${metric('Total leads', fmtNumber(state.leads.length), `${state.leads.filter(lead => ACTIVE_LEAD_STAGES.includes(lead.stage)).length} active`)}${metric('Follow-ups today', fmtNumber(todayFollowups.length), `${overdueFollowups.length} overdue`)}${metric('Proposals active', fmtNumber(proposals.length), `${negotiating.length} negotiating`)}${metric('Active client MRR', fmtCurrency(mrr), `${activeClients.length} active clients`)}${metric('Stale leads', fmtNumber(stale.length), 'Needs attention')}${metric('Open work', fmtNumber(openWork.length), `${openWork.filter(item => item.due_date && isPast(item.due_date)).length} overdue`)}${metric('Upcoming shoots', fmtNumber(upcomingShoots.length), 'Next scheduled production')}${metric('Won leads', fmtNumber(state.leads.filter(lead => lead.stage === 'won').length), 'Converted to clients')}</section><div class="dashboard-grid"><section class="panel span-2"><div class="panel-header"><div><p class="eyebrow">PIPELINE</p><h3>Leads by stage</h3><p>Every row is live database data.</p></div><a class="panel-link" href="#/pipeline">Open pipeline →</a></div><div class="stage-list">${STAGES.map(([stage, label]) => { const count = state.leads.filter(lead => lead.stage === stage).length; return `<div class="stage-row"><a href="#/leads?stage=${stage}">${esc(label)}</a><div class="stage-track"><div class="stage-fill" style="width:${Math.max(count ? 4 : 0, (count / maxStage) * 100)}%"></div></div><strong>${count}</strong></div>` }).join('')}</div></section><section class="panel"><div class="panel-header"><div><p class="eyebrow">ATTENTION</p><h3>Needs action</h3><p>Overdue and stale leads.</p></div><span class="badge badge-dark">${attention.length}</span></div>${attention.length ? `<div class="list">${attention.map(item => `<a class="list-item" href="#/leads/${item.lead.id}"><span class="list-icon">${icon('alert')}</span><span class="grow"><strong>${esc(item.lead.company_name)}</strong><p>${esc(item.reason)}</p><small>${esc(item.when)}</small></span></a>`).join('')}</div>` : emptyState('Nothing urgent', 'No stale or overdue leads right now.')}</section><section class="panel"><div class="panel-header"><div><p class="eyebrow">PRODUCTION</p><h3>Upcoming shoots</h3></div><a class="panel-link" href="#/clients">Clients →</a></div>${upcomingShoots.length ? `<div class="shoot-list">${upcomingShoots.map(shoot => shootCardHtml(shoot, false)).join('')}</div>` : emptyState('No shoots scheduled', 'Add a shoot from a client workspace.')}</section><section class="panel span-2"><div class="panel-header"><div><p class="eyebrow">TEAM</p><h3>Current workload</h3><p>Assigned active leads, tasks and deliverables.</p></div><a class="panel-link" href="#/team">Manage team →</a></div><div class="table-wrap"><table><thead><tr><th>Team member</th><th>Active leads</th><th>Open tasks</th><th>Open work</th></tr></thead><tbody>${workload.map(item => `<tr><td><strong>${esc(item.profile.full_name)}</strong><small>${esc(item.profile.job_title || humanize(item.profile.role))}</small></td><td>${item.leads}</td><td>${item.tasks}</td><td>${item.work}</td></tr>`).join('')}</tbody></table></div></section><section class="panel span-all"><div class="panel-header"><div><p class="eyebrow">RECENT</p><h3>Latest activity</h3></div><a class="panel-link" href="#/activities">Full history →</a></div>${timelineHtml(state.activities.slice(0, 7))}</section></div>`
}

function memberDashboardHtml() {
  const myLeads = state.leads
  const due = myLeads.filter(lead => lead.next_follow_up_at && (isToday(lead.next_follow_up_at) || isPast(lead.next_follow_up_at)))
  const myTasks = state.tasks.filter(activeTask)
  const myWork = state.deliverables.filter(item => !['delivered', 'approved'].includes(item.status))
  const shoots = state.shoots.filter(shoot => !isPast(shoot.scheduled_at) && ['planned', 'confirmed', 'rescheduled'].includes(shoot.status)).slice(0, 6)
  return `${pageHeading('My workspace', 'Only leads, clients and work assigned to you are shown.', `<button class="btn btn-primary" data-action="task-add">${icon('plus')} Add personal task</button>`)}<section class="metrics">${metric('My active leads', fmtNumber(myLeads.filter(lead => ACTIVE_LEAD_STAGES.includes(lead.stage)).length), `${myLeads.length} visible`)}${metric('Due follow-ups', fmtNumber(due.length), 'Today or overdue')}${metric('Open tasks', fmtNumber(myTasks.length), `${myTasks.filter(dueTask).length} due`)}${metric('Open deliverables', fmtNumber(myWork.length), `${myWork.filter(item => item.due_date && isPast(item.due_date)).length} overdue`)}</section><div class="dashboard-grid"><section class="panel span-2"><div class="panel-header"><div><p class="eyebrow">TODAY</p><h3>Follow-ups and tasks</h3></div><a class="panel-link" href="#/follow-ups">All follow-ups →</a></div>${due.length || myTasks.length ? `<div class="list">${due.slice(0, 5).map(lead => `<a class="list-item" href="#/leads/${lead.id}"><span class="list-icon">${icon('phone')}</span><span class="grow"><strong>${esc(lead.company_name)}</strong><p>${esc(lead.remarks || lead.next_follow_up_note || 'Follow up')}</p><small>${esc(leadFollowupText(lead))}</small></span></a>`).join('')}${myTasks.slice(0, 5).map(task => `<div class="list-item"><span class="list-icon">${icon('check')}</span><span class="grow"><strong>${esc(task.title)}</strong><p>${esc(task.description || 'Task')}</p><small>${fmtDate(task.due_at, true)}</small></span><button class="btn btn-secondary btn-sm" data-action="task-complete" data-id="${task.id}">Done</button></div>`).join('')}</div>` : emptyState('You are clear', 'No due follow-ups or open tasks.')}</section><section class="panel"><div class="panel-header"><div><p class="eyebrow">SHOOTS</p><h3>Upcoming production</h3></div></div>${shoots.length ? `<div class="shoot-list">${shoots.map(shoot => shootCardHtml(shoot, false)).join('')}</div>` : emptyState('No scheduled shoots', 'Assigned shoots will appear here.')}</section><section class="panel span-all"><div class="panel-header"><div><p class="eyebrow">WORK</p><h3>Assigned deliverables</h3></div></div>${myWork.length ? workListHtml(myWork, false) : emptyState('No assigned work', 'Your assigned deliverables will appear here.')}</section></div>`
}

function leadsHtml() {
  const query = state.filters.leadQuery || ''
  const routeStage = route().query.get('stage')
  const stage = routeStage || state.filters.leadStage || ''
  const priority = state.filters.leadPriority || ''
  const industry = state.filters.leadIndustry || ''
  const filtered = state.leads.filter(lead => {
    const text = [lead.company_name, lead.contact_person, lead.phone, lead.email, lead.remarks, lead.next_follow_up_note].join(' ').toLowerCase()
    return (!query || text.includes(query.toLowerCase())) && (!stage || lead.stage === stage) && (!priority || lead.priority === priority) && (!industry || lead.industry === industry)
  })
  return `${pageHeading(isAdmin() ? 'Leads' : 'My leads', `${filtered.length} of ${state.leads.length} lead records`, isAdmin() ? `<button class="btn btn-primary" data-action="lead-add">${icon('plus')} Add lead</button>` : '')}<section class="panel"><div class="toolbar"><div class="search-box">${icon('search')}<input data-filter="lead-query" placeholder="Search company, phone, email or notes" value="${attr(query)}"></div><select data-filter="lead-stage"><option value="">All stages</option>${optionList(STAGES, stage)}</select><select data-filter="lead-priority"><option value="">All priorities</option>${optionList(PRIORITIES, priority)}</select><select data-filter="lead-industry"><option value="">All business types</option>${optionList([...new Set(state.leads.map(lead => lead.industry).filter(Boolean))].sort(), industry)}</select></div><div class="table-wrap"><table><thead><tr><th>Lead</th><th>Stage</th><th>Priority</th><th>Score</th><th>Owner</th><th>Next follow-up</th><th>Last update</th></tr></thead><tbody>${filtered.length ? filtered.map(lead => `<tr><td><a class="row-link" href="#/leads/${lead.id}"><strong>${esc(lead.company_name)}</strong><small>${esc(lead.phone || lead.email || lead.industry || 'No contact details')}</small></a></td><td>${badgeStage(lead.stage)}</td><td>${badgePriority(lead.priority)}</td><td>${badgeScore(lead.score || calculateScore(lead).total)}</td><td>${esc(profileName(lead.assigned_to))}</td><td>${lead.next_follow_up_at && isPast(lead.next_follow_up_at) ? '<span class="stale-flag">' : ''}${esc(leadFollowupText(lead))}${lead.next_follow_up_at && isPast(lead.next_follow_up_at) ? '</span>' : ''}</td><td>${fmtDate(lead.updated_at, true)}</td></tr>`).join('') : `<tr><td colspan="7">${emptyState('No matching leads', 'Change the filters or import the Google Sheet.')}</td></tr>`}</tbody></table></div></section>`
}

function leadDetailHtml(id) {
  const lead = state.leads.find(item => item.id === id)
  if (!lead) return emptyState('Lead not found', 'This lead may not be assigned to your account.')
  const requirement = requirementFor(id)
  const activities = state.activities.filter(item => item.lead_id === id)
  const tasks = state.tasks.filter(item => item.lead_id === id)
  const score = calculateScore(lead)
  const stale = staleResult(lead)
  const client = state.clients.find(item => item.lead_id === id)
  return `<a class="panel-link" href="#/leads">← Back to leads</a><section class="detail-hero"><p class="eyebrow">${esc(lead.industry || 'LEAD')}</p><h2>${esc(lead.company_name)}</h2><p>${esc(lead.remarks || 'No current situation has been recorded yet.')}</p><div class="detail-hero-actions">${badgeStage(lead.stage)}${badgePriority(lead.priority)}${badgeScore(lead.score || score.total)}<button class="btn btn-secondary" data-action="lead-edit" data-id="${lead.id}">${icon('edit')} Edit</button><button class="btn btn-secondary" data-action="activity-add" data-lead="${lead.id}">${icon('activity')} Add activity</button><button class="btn btn-secondary" data-action="task-add" data-lead="${lead.id}">${icon('check')} Add task</button>${isAdmin() && !client ? `<button class="btn btn-primary" data-action="client-convert" data-lead="${lead.id}">${icon('briefcase')} Sign as client</button>` : ''}${client ? `<a class="btn btn-primary" href="#/clients/${client.id}">Open client workspace</a>` : ''}${isAdmin() ? `<button class="btn btn-danger" data-action="lead-delete" data-id="${lead.id}">${icon('trash')} Delete</button>` : ''}</div></section>${stale.stale ? `<div class="form-message"><strong>${esc(stale.reason)}</strong><br>${esc(stale.suggestion || '')}</div><br>` : ''}<div class="detail-grid"><section class="panel"><div class="panel-header"><div><p class="eyebrow">CONTACT</p><h3>Lead information</h3></div></div>${detailListHtml([['Contact person', lead.contact_person], ['Phone', lead.phone], ['WhatsApp', lead.whatsapp], ['Email', lead.email], ['Business type', lead.industry], ['Lead source', lead.lead_source], ['First contacted', fmtDate(lead.date_first_contacted)], ['Owner', profileName(lead.assigned_to)], ['Original Sheet status', lead.sheet_status_text], ['Sheet row', lead.sheet_row_number ? `Row ${lead.sheet_row_number}` : null]])}</section><section class="panel"><div class="panel-header"><div><p class="eyebrow">NEXT STEP</p><h3>Follow-up and links</h3></div></div>${detailListHtml([['Next follow-up', leadFollowupText(lead)], ['Follow-up note', lead.next_follow_up_note], ['Proposal', lead.proposal_url ? `<a class="panel-link" target="_blank" rel="noopener" href="${attr(safeUrl(lead.proposal_url))}">Open proposal ↗</a>` : null], ['Drive folder', lead.drive_folder_url ? `<a class="panel-link" target="_blank" rel="noopener" href="${attr(safeUrl(lead.drive_folder_url))}">Open Drive ↗</a>` : null], ['Website', lead.website ? `<a class="panel-link" target="_blank" rel="noopener" href="${attr(safeUrl(lead.website, true))}">${esc(lead.website)} ↗</a>` : null]])}</section><section class="panel"><div class="panel-header"><div><p class="eyebrow">REQUIREMENTS</p><h3>What the client needs</h3></div></div>${requirement ? detailListHtml([['Videos monthly', requirement.monthly_videos], ['Graphics monthly', requirement.monthly_graphics], ['Shoot frequency', requirement.shoot_frequency], ['Posting needs', requirement.posting_requirements], ['Approximate budget', fmtCurrency(requirement.approximate_budget)], ['Models', requirement.models_required ? 'Required' : 'Not specified'], ['Voice-over', requirement.voiceover_required ? 'Required' : 'Not specified'], ['Content creator', requirement.content_creator_required ? 'Required' : 'Not specified'], ['Social handling', requirement.social_media_handling_required ? 'Required' : 'Not specified'], ['Special expectations', requirement.special_expectations]]) : emptyState('No requirements yet', 'Edit the lead and record the requirements.')}</section><section class="panel"><div class="panel-header"><div><p class="eyebrow">LEAD SCORE</p><h3>${score.total}/100 · ${humanize(scoreClass(score.total))}</h3></div></div><div class="score-breakdown">${score.factors.map(([label, value, max]) => `<div class="score-factor"><span>${esc(label)}</span><div class="factor-track"><i style="width:${(value / max) * 100}%"></i></div><strong>${value}/${max}</strong></div>`).join('')}</div></section><section class="panel wide"><div class="panel-header"><div><p class="eyebrow">ACTIVITY</p><h3>Conversation timeline</h3></div><button class="btn btn-secondary btn-sm" data-action="activity-add" data-lead="${lead.id}">Add activity</button></div>${timelineHtml(activities)}</section><section class="panel wide"><div class="panel-header"><div><p class="eyebrow">TASKS</p><h3>Open and completed actions</h3></div><button class="btn btn-secondary btn-sm" data-action="task-add" data-lead="${lead.id}">Add task</button></div>${tasks.length ? tasksListHtml(tasks) : emptyState('No tasks', 'Add the next action for this lead.')}</section></div>`
}

function detailListHtml(rows) { return `<dl class="info-grid">${rows.map(([label, value]) => { const rendered = value === 0 ? '0' : (!value ? '—' : (/^<a class=\"panel-link\"/.test(String(value)) ? String(value) : esc(value))); return `<div><dt>${esc(label)}</dt><dd>${rendered}</dd></div>` }).join('')}</dl>` }
function timelineHtml(items) { return items.length ? `<div class="timeline">${items.map(item => `<div class="timeline-item"><div class="timeline-rail"><div class="timeline-dot"></div></div><div class="timeline-content"><div><strong>${esc(item.summary)}</strong> <span class="badge badge-soft">${esc(humanize(item.type))}</span></div><p>${esc(item.details || item.client_response || 'No additional details.')}</p>${item.next_action ? `<small>Next: ${esc(item.next_action)}</small>` : ''}<small>${fmtDate(item.created_at, true)} · ${esc(profileName(item.created_by))}</small></div></div>`).join('')}</div>` : emptyState('No activity recorded', 'Calls, messages, meetings and proposals will appear here.') }
function tasksListHtml(tasks) { return `<div class="list">${tasks.sort((a, b) => String(a.due_at || '').localeCompare(String(b.due_at || ''))).map(task => `<div class="list-item"><span class="list-icon">${icon(task.status === 'completed' ? 'check' : 'calendar')}</span><span class="grow"><strong>${esc(task.title)}</strong><p>${esc(task.description || 'No description')}</p><small>${task.due_at ? fmtDate(task.due_at, true) : 'No due date'} · ${esc(profileName(task.assigned_to))}</small></span>${badgeStatus(task.status)}${task.status === 'pending' ? `<button class="btn btn-secondary btn-sm" data-action="task-complete" data-id="${task.id}">Done</button>` : ''}${isAdmin() ? `<button class="btn btn-ghost btn-sm" data-action="task-delete" data-id="${task.id}" title="Delete task">${icon('trash')}</button>` : ''}</div>`).join('')}</div>` }

function pipelineHtml() {
  return `${pageHeading(isAdmin() ? 'Lead pipeline' : 'My pipeline', 'Drag a card to change its stage. Every movement is recorded as an activity.', isAdmin() ? `<button class="btn btn-primary" data-action="lead-add">${icon('plus')} Add lead</button>` : '')}<div class="kanban">${STAGES.map(([stage, label]) => { const items = state.leads.filter(lead => lead.stage === stage); return `<section class="kanban-column" data-drop-stage="${stage}"><div class="kanban-head"><strong>${esc(label)}</strong><span>${items.length}</span></div><div class="kanban-cards">${items.length ? items.map(lead => `<article class="kanban-card" draggable="true" data-drag-lead="${lead.id}"><a href="#/leads/${lead.id}"><div class="kanban-meta"><h4>${esc(lead.company_name)}</h4>${badgeScore(lead.score || calculateScore(lead).total)}</div><p>${esc(lead.remarks || lead.next_follow_up_note || 'No current note')}</p><div class="kanban-meta">${badgePriority(lead.priority)}<span class="badge badge-line">${esc(profileName(lead.assigned_to))}</span></div><small>Follow-up: ${esc(leadFollowupText(lead))}</small></a></article>`).join('') : '<div class="kanban-empty">Drop a lead here</div>'}</div></section>` }).join('')}</div>`
}

function bindPipeline() {
  document.querySelectorAll('[data-drag-lead]').forEach(card => {
    card.addEventListener('dragstart', event => { card.classList.add('dragging'); event.dataTransfer.setData('text/plain', card.dataset.dragLead) })
    card.addEventListener('dragend', () => card.classList.remove('dragging'))
  })
  document.querySelectorAll('[data-drop-stage]').forEach(column => {
    column.addEventListener('dragover', event => { event.preventDefault(); column.classList.add('drag-over') })
    column.addEventListener('dragleave', () => column.classList.remove('drag-over'))
    column.addEventListener('drop', async event => {
      event.preventDefault(); column.classList.remove('drag-over')
      const leadId = event.dataTransfer.getData('text/plain'); const newStage = column.dataset.dropStage; const lead = state.leads.find(item => item.id === leadId)
      if (!lead || lead.stage === newStage) return
      try {
        assertOnline()
        await updateRecord('leads', leadId, { stage: newStage, score: calculateScore({ ...lead, stage: newStage }).total, last_activity_at: todayIso(), updated_at: todayIso() })
        await insertRecord('activities', { lead_id: leadId, type: 'stage_change', summary: `Stage changed from ${stageLabel(lead.stage)} to ${stageLabel(newStage)}`, created_by: state.profile.id })
        await refreshAndRender('Pipeline updated')
      } catch (error) { toast('Could not move lead', error.message, 'error') }
    })
  })
}

function followupsHtml() {
  const active = state.leads.filter(lead => ACTIVE_LEAD_STAGES.includes(lead.stage))
  const overdue = active.filter(lead => lead.next_follow_up_at && isPast(lead.next_follow_up_at))
  const today = active.filter(lead => lead.next_follow_up_at && isToday(lead.next_follow_up_at))
  const upcoming = active.filter(lead => lead.next_follow_up_at && withinDays(lead.next_follow_up_at, 14) && !isToday(lead.next_follow_up_at)).sort((a, b) => String(a.next_follow_up_at).localeCompare(String(b.next_follow_up_at)))
  const notesOnly = active.filter(lead => !lead.next_follow_up_at && lead.next_follow_up_note)
  const section = (title, items, copy) => `<section class="panel"><div class="panel-header"><div><p class="eyebrow">FOLLOW-UP</p><h3>${esc(title)}</h3><p>${esc(copy)}</p></div><span class="badge ${items.length ? 'badge-dark' : 'badge-soft'}">${items.length}</span></div>${items.length ? `<div class="list">${items.map(lead => `<a class="list-item" href="#/leads/${lead.id}"><span class="list-icon">${icon('phone')}</span><span class="grow"><strong>${esc(lead.company_name)}</strong><p>${esc(lead.remarks || lead.next_follow_up_note || 'Follow up')}</p><small>${esc(leadFollowupText(lead))} · ${esc(profileName(lead.assigned_to))}</small></span>${badgeStage(lead.stage)}</a>`).join('')}</div>` : emptyState('Nothing here', 'No leads in this group.')}</section>`
  return `${pageHeading('Follow-ups', 'A single view for overdue, today and upcoming client contact.', `<button class="btn btn-secondary" data-action="task-add">${icon('plus')} Add task</button>`)}<div class="dashboard-grid">${section('Overdue', overdue, 'These should be handled first.')}${section('Today', today, 'Scheduled for today.')}${section('Next 14 days', upcoming, 'Upcoming dated follow-ups.')}<div class="span-all">${section('Notes without a date', notesOnly, 'Imported Sheet instructions such as “call Sunday” or “send proposal in email”.')}</div></div>`
}

function clientsHtml() {
  const query = state.filters.clientQuery || ''
  const clients = state.clients.filter(client => [client.company_name, client.contact_person, client.industry, client.package_name].join(' ').toLowerCase().includes(query.toLowerCase()))
  return `${pageHeading(isAdmin() ? 'Clients' : 'My clients', 'Signed-client workspaces for monthly scope, shoots, approvals and delivery.', isAdmin() ? `<button class="btn btn-primary" data-action="client-add">${icon('plus')} Add client</button>` : '')}<section class="panel"><div class="toolbar"><div class="search-box">${icon('search')}<input data-filter="client-query" placeholder="Search clients" value="${attr(query)}"></div></div>${clients.length ? `<div class="client-cards">${clients.map(client => { const cycle = selectedCycle(client.id); const work = state.deliverables.filter(item => item.client_id === client.id && (!cycle || item.cycle_id === cycle.id)); const promised = countPromised(work); const completed = countCompleted(work); const progress = promised ? Math.round((completed / promised) * 100) : 0; const fin = financialFor(client.id); return `<a class="client-card" href="#/clients/${client.id}">${badgeStatus(client.status)}<h3>${esc(client.company_name)}</h3><p>${esc(client.package_name || client.scope_summary || 'Client workspace')}</p><div class="progress-block"><div class="progress-head"><span>${cycle ? esc(cycle.label) : 'No active cycle'}</span><strong>${progress}%</strong></div><div class="progress-track"><i style="width:${progress}%"></i></div></div><footer><span class="badge badge-line">${work.length} work items</span>${isAdmin() ? `<strong>${fmtCurrency(fin?.monthly_fee || 0)}</strong>` : `<span>${esc(profileName(client.account_manager))}</span>`}</footer></a>` }).join('')}</div>` : emptyState('No clients yet', 'Convert a won lead or add a client workspace.')}</section>`
}

function clientDetailHtml(id) {
  const client = state.clients.find(item => item.id === id)
  if (!client) return emptyState('Client not found', 'This client may not be assigned to your account.')
  const financial = financialFor(id)
  const cycles = state.cycles.filter(cycle => cycle.client_id === id).sort((a, b) => String(b.period_start).localeCompare(String(a.period_start)))
  const cycle = selectedCycle(id)
  const work = state.deliverables.filter(item => item.client_id === id && (!cycle || item.cycle_id === cycle.id))
  const shoots = state.shoots.filter(item => item.client_id === id && (!cycle || !item.cycle_id || item.cycle_id === cycle.id))
  const payments = state.payments.filter(item => item.client_id === id)
  const activities = state.activities.filter(item => item.client_id === id || item.lead_id === client.lead_id)
  const promised = countPromised(work); const completed = countCompleted(work); const progress = promised ? Math.round((completed / promised) * 100) : 0
  const nextShoot = shoots.filter(item => !isPast(item.scheduled_at) && !['completed', 'cancelled'].includes(item.status)).sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))[0]
  const outstanding = payments.filter(item => !['paid', 'waived'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  return `<a class="panel-link" href="#/clients">← Back to clients</a><section class="detail-hero"><p class="eyebrow">SIGNED CLIENT</p><h2>${esc(client.company_name)}</h2><p>${esc(client.scope_summary || 'Add the agreed scope so the team can clearly see what Vireon has promised.')}</p><div class="detail-hero-actions">${badgeStatus(client.status)}<span class="badge badge-line">${esc(client.package_name || 'Custom package')}</span>${isAdmin() ? `<button class="btn btn-secondary" data-action="client-edit" data-id="${client.id}">${icon('edit')} Edit client</button><button class="btn btn-secondary" data-action="cycle-add" data-client="${client.id}">${icon('calendar')} New month</button><button class="btn btn-secondary" data-action="shoot-add" data-client="${client.id}">${icon('plus')} Add shoot</button><button class="btn btn-primary" data-action="deliverable-add" data-client="${client.id}">${icon('plus')} Add work</button><button class="btn btn-danger" data-action="client-delete" data-id="${client.id}">${icon('trash')} Delete</button>` : ''}</div></section><section class="metrics">${metric('Cycle progress', `${progress}%`, `${completed} completed of ${promised}`)}${metric('Open work items', work.filter(item => !['approved', 'delivered'].includes(item.status)).length, `${work.filter(item => item.due_date && isPast(item.due_date)).length} overdue`)}${metric('Next shoot', nextShoot ? fmtDate(nextShoot.scheduled_at, true) : 'Not set', nextShoot?.location || 'Schedule from this workspace')}${isAdmin() ? metric('Outstanding', fmtCurrency(outstanding), `${payments.filter(item => item.status === 'paid').length} paid records`) : metric('Account manager', profileName(client.account_manager), 'Primary Vireon owner')}</section><div class="detail-grid"><section class="panel"><div class="panel-header"><div><p class="eyebrow">CLIENT</p><h3>Partnership information</h3></div></div>${detailListHtml([['Contact person', client.contact_person], ['Phone', client.phone], ['Email', client.email], ['Industry', client.industry], ['Package', client.package_name], ['Services', (client.services || []).join(', ')], ['Contract', `${fmtDate(client.contract_start)} — ${fmtDate(client.contract_end)}`], ['Renewal', fmtDate(client.renewal_date)], ['Account manager', profileName(client.account_manager)], ['Approval contact', client.approval_contact]])}</section><section class="panel"><div class="panel-header"><div><p class="eyebrow">LINKS & NOTES</p><h3>Working references</h3></div></div>${detailListHtml([['Drive folder', client.drive_folder_url ? `<a class="panel-link" target="_blank" rel="noopener" href="${attr(safeUrl(client.drive_folder_url))}">Open Drive ↗</a>` : null], ['Contract', client.contract_url ? `<a class="panel-link" target="_blank" rel="noopener" href="${attr(safeUrl(client.contract_url))}">Open contract ↗</a>` : null], ['Internal notes', client.notes], ...(isAdmin() ? [['Monthly fee', fmtCurrency(financial?.monthly_fee || 0)], ['Billing cycle', humanize(financial?.billing_cycle || 'monthly')], ['Payment terms', financial?.payment_terms]] : [])])}</section><section class="panel wide"><div class="panel-header"><div><p class="eyebrow">MONTHLY CYCLE</p><h3>Promised vs completed</h3><p>Every month remains saved as separate history.</p></div>${isAdmin() ? `<button class="btn btn-secondary btn-sm" data-action="cycle-add" data-client="${client.id}">New cycle</button>` : ''}</div>${cycles.length ? `<div class="cycle-tabs">${cycles.map(item => `<button class="cycle-tab ${cycle?.id === item.id ? 'active' : ''}" data-action="cycle-select" data-client="${client.id}" data-id="${item.id}">${esc(item.label)} · ${esc(humanize(item.status))}</button>`).join('')}</div>` : ''}${cycle ? `<div class="progress-block"><div class="progress-head"><span>${fmtDate(cycle.period_start)} — ${fmtDate(cycle.period_end)}</span><strong>${completed}/${promised} completed</strong></div><div class="progress-track"><i style="width:${progress}%"></i></div></div>` : ''}${work.length ? workListHtml(work, true) : emptyState('No deliverables in this cycle', 'Add the exact promised videos, graphics, shoots and other work.')}</section><section class="panel wide"><div class="panel-header"><div><p class="eyebrow">PRODUCTION</p><h3>Shoots</h3></div>${isAdmin() ? `<button class="btn btn-secondary btn-sm" data-action="shoot-add" data-client="${client.id}">Add shoot</button>` : ''}</div>${shoots.length ? `<div class="shoot-list">${shoots.map(shoot => shootCardHtml(shoot, true)).join('')}</div>` : emptyState('No shoots scheduled', 'Add the next production date, time and location.')}</section>${isAdmin() ? `<section class="panel wide"><div class="panel-header"><div><p class="eyebrow">ADMIN FINANCE</p><h3>Payments</h3></div><button class="btn btn-secondary btn-sm" data-action="payment-add" data-client="${client.id}">Add payment</button></div>${payments.length ? paymentsListHtml(payments) : emptyState('No payment schedule', 'Add invoices, due dates and received payments.')}</section>` : ''}<section class="panel wide"><div class="panel-header"><div><p class="eyebrow">HISTORY</p><h3>Client timeline</h3></div><button class="btn btn-secondary btn-sm" data-action="activity-add" data-client="${client.id}" data-lead="${client.lead_id || ''}">Add activity</button></div>${timelineHtml(activities)}</section></div>`
}

function workListHtml(items, showControls) {
  return `<div class="work-list">${items.map(item => { const canEdit = showControls && (isAdmin() || item.assigned_to === state.profile.id || canManageClient(item.client_id)); return `<div class="work-row"><div><strong>${esc(item.title)}</strong><small>${esc(item.category)} · Due ${fmtDate(item.due_date)}</small></div><div class="progress-block"><div class="progress-head"><span>${item.completed_quantity}/${item.quantity}</span><strong>${Math.round((Number(item.completed_quantity || 0) / Math.max(1, Number(item.quantity || 1))) * 100)}%</strong></div><div class="progress-track"><i style="width:${Math.min(100, (Number(item.completed_quantity || 0) / Math.max(1, Number(item.quantity || 1))) * 100)}%"></i></div></div>${canEdit ? `<div class="qty-control"><input data-action="deliverable-qty" data-id="${item.id}" type="number" min="0" max="${item.quantity}" value="${item.completed_quantity}"><span>/ ${item.quantity}</span></div><select class="inline-select" data-action="deliverable-status" data-id="${item.id}">${optionList(DELIVERABLE_STATUSES, item.status)}</select>${isAdmin() ? `<button class="btn btn-ghost btn-sm" data-action="deliverable-delete" data-id="${item.id}" title="Delete">${icon('trash')}</button>` : ''}` : `<div>${badgeStatus(item.status)}</div><div><small>${esc(profileName(item.assigned_to))}</small></div>`}</div>` }).join('')}</div>`
}

function shootCardHtml(shoot, showControls) {
  const d = localDate(shoot.scheduled_at)
  const canEdit = showControls && (isAdmin() || shoot.assigned_to === state.profile.id || canManageClient(shoot.client_id))
  return `<div class="shoot-card"><div class="shoot-date"><strong>${d ? d.getDate() : '—'}</strong>${d ? new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d) : ''}</div><div class="grow"><strong>${esc(shoot.title)}</strong><p>${fmtDate(shoot.scheduled_at, true)}${shoot.location ? ` · ${esc(shoot.location)}` : ''}</p><small>${esc(shoot.notes || profileName(shoot.assigned_to))}</small></div>${canEdit ? `<select class="inline-select" data-action="shoot-status" data-id="${shoot.id}">${optionList(SHOOT_STATUSES, shoot.status)}</select>${isAdmin() ? `<button class="btn btn-ghost btn-sm" data-action="shoot-delete" data-id="${shoot.id}">${icon('trash')}</button>` : ''}` : badgeStatus(shoot.status)}</div>`
}
function paymentsListHtml(payments) { return `<div class="table-wrap"><table><thead><tr><th>Description</th><th>Amount</th><th>Due</th><th>Status</th><th>Paid</th><th></th></tr></thead><tbody>${payments.map(item => `<tr><td><strong>${esc(item.description)}</strong><small>${esc(item.payment_method || '')}</small></td><td>${fmtCurrency(item.amount)}</td><td>${fmtDate(item.due_date)}</td><td><select class="inline-select" data-action="payment-status" data-id="${item.id}">${optionList(PAYMENT_STATUSES, item.status)}</select></td><td>${fmtDate(item.paid_at, true)}</td><td><button class="btn btn-ghost btn-sm" data-action="payment-delete" data-id="${item.id}" title="Delete payment">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div>` }

function activitiesHtml() { return `${pageHeading('Activity history', 'Calls, messages, meetings, proposals, payments and internal notes.', `<button class="btn btn-primary" data-action="activity-add">${icon('plus')} Add internal note</button>`)}<section class="panel">${timelineHtml(state.activities)}</section>` }

function quickRepliesHtml() {
  const query = state.filters.replyQuery || ''
  const replies = state.quickReplies.filter(item => !item.is_archived && [item.title, item.category, item.message_body, item.language].join(' ').toLowerCase().includes(query.toLowerCase()))
  return `${pageHeading('Quick replies', 'Human, reusable client messages. Copy once and personalize before sending.', isAdmin() ? `<button class="btn btn-primary" data-action="reply-add">${icon('plus')} Add reply</button>` : '')}<section class="panel"><div class="toolbar"><div class="search-box">${icon('search')}<input data-filter="reply-query" placeholder="Search messages" value="${attr(query)}"></div></div><div class="client-cards">${replies.map(item => `<article class="client-card"><div class="kanban-meta"><span class="badge badge-blue">${esc(item.category)}</span><span class="badge badge-line">${esc(item.language)}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.message_body)}</p><footer><button class="btn btn-primary btn-sm" data-action="reply-copy" data-id="${item.id}">${icon('copy')} Copy</button>${isAdmin() ? `<button class="btn btn-secondary btn-sm" data-action="reply-edit" data-id="${item.id}">Edit</button>` : ''}<small>${item.usage_count || 0} uses</small></footer></article>`).join('')}</div></section>`
}

function reportsHtml() {
  requireAdmin()
  const won = state.leads.filter(lead => lead.stage === 'won').length
  const lost = state.leads.filter(lead => lead.stage === 'lost').length
  const closed = won + lost
  const conversion = closed ? Math.round((won / closed) * 100) : 0
  const activeClients = state.clients.filter(client => client.status === 'active')
  const mrr = state.clientFinancials.filter(fin => activeClients.some(client => client.id === fin.client_id) && fin.billing_cycle === 'monthly').reduce((sum, fin) => sum + Number(fin.monthly_fee || 0), 0)
  const paid = state.payments.filter(item => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const outstanding = state.payments.filter(item => !['paid', 'waived'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const max = Math.max(1, ...STAGES.map(([stage]) => state.leads.filter(lead => lead.stage === stage).length))
  const sourceCounts = Object.entries(state.leads.reduce((acc, lead) => { const key = lead.lead_source || 'Unknown'; acc[key] = (acc[key] || 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1])
  const industryCounts = Object.entries(state.leads.reduce((acc, lead) => { const key = lead.industry || 'Unknown'; acc[key] = (acc[key] || 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1])
  return `${pageHeading('Reports', 'Live sales, client revenue and workload reporting from Supabase.', `<button class="btn btn-secondary" data-action="export-leads">${icon('download')} Export leads CSV</button><button class="btn btn-primary" data-action="export-clients">${icon('download')} Export clients CSV</button>`)}<section class="metrics">${metric('Conversion rate', `${conversion}%`, `${won} won / ${closed} closed`)}${metric('Active client MRR', fmtCurrency(mrr), `${activeClients.length} clients`)}${metric('Payments received', fmtCurrency(paid), 'All recorded paid items')}${metric('Outstanding payments', fmtCurrency(outstanding), `${state.payments.filter(item => item.status === 'overdue').length} overdue`)}</section><div class="report-grid"><section class="panel"><div class="panel-header"><div><p class="eyebrow">FUNNEL</p><h3>Pipeline distribution</h3></div></div><div class="funnel">${STAGES.map(([stage, label]) => { const count = state.leads.filter(lead => lead.stage === stage).length; return `<div class="funnel-row"><span>${esc(label)}</span><div class="funnel-bar"><i style="width:${(count / max) * 100}%"></i></div><strong>${count}</strong></div>` }).join('')}</div></section><section class="panel"><div class="panel-header"><div><p class="eyebrow">SOURCES</p><h3>Where leads come from</h3></div></div><div class="stage-list">${sourceCounts.map(([label, count]) => `<div class="stage-row"><span>${esc(label)}</span><div class="stage-track"><div class="stage-fill" style="width:${(count / Math.max(1, sourceCounts[0]?.[1] || 1)) * 100}%"></div></div><strong>${count}</strong></div>`).join('')}</div></section><section class="panel span-all"><div class="panel-header"><div><p class="eyebrow">BUSINESS TYPES</p><h3>Lead mix</h3></div></div><div class="stage-list">${industryCounts.map(([label, count]) => `<div class="stage-row"><span>${esc(label)}</span><div class="stage-track"><div class="stage-fill" style="width:${(count / Math.max(1, industryCounts[0]?.[1] || 1)) * 100}%"></div></div><strong>${count}</strong></div>`).join('')}</div></section></div>`
}

function teamHtml() {
  requireAdmin()
  return `${pageHeading('Team access', 'Create Team Member accounts, assign work and control access from one place.', state.config.teamAdminConfigured ? `<button class="btn btn-primary" data-action="team-add">${icon('plus')} Add teammate</button>` : '')}${!state.config.teamAdminConfigured ? `<div class="form-message"><strong>One Netlify variable is missing.</strong><br>Add SUPABASE_SECRET_KEY (recommended) or the legacy SUPABASE_SERVICE_ROLE_KEY to enable secure account creation and password resets inside the app. You can still create users manually in Supabase Authentication.</div><br>` : ''}<div class="team-grid">${state.profiles.map(profile => { const leadCount = state.leads.filter(lead => lead.assigned_to === profile.id).length; const taskCount = state.tasks.filter(task => task.assigned_to === profile.id && activeTask(task)).length; return `<article class="team-card"><div class="team-card-head"><div class="user-avatar">${esc(initials(profile.full_name))}</div><div><h3>${esc(profile.full_name)}</h3><p>${esc(profile.email || 'No email')} · ${esc(profile.job_title || humanize(profile.role))}</p></div></div><div class="progress-block"><div class="progress-head"><span>${leadCount} leads</span><span>${taskCount} tasks</span></div></div><div><span class="badge ${profile.role === 'admin' ? 'badge-blue' : 'badge-line'}">${esc(profile.role === 'admin' ? 'Administrator' : 'Team Member')}</span></div><footer>${profile.is_active === false ? `<button class="btn btn-primary btn-sm" data-action="team-activate" data-id="${profile.id}">Activate</button>` : profile.id !== state.profile.id ? `<button class="btn btn-secondary btn-sm" data-action="team-deactivate" data-id="${profile.id}">Deactivate</button>` : '<span class="badge badge-blue">Your account</span>'}${state.config.teamAdminConfigured ? `<button class="btn btn-secondary btn-sm" data-action="team-reset" data-id="${profile.id}" data-name="${attr(profile.full_name)}">Reset password</button>` : ''}${badgeStatus(profile.is_active === false ? 'cancelled' : 'active')}</footer></article>` }).join('')}</div>`
}

function settingsHtml() {
  requireAdmin()
  const lastSync = state.syncLogs[0]
  return `${pageHeading('Settings', 'Cloud status, team security and the live Google Sheets connection.', '')}<div class="settings-grid"><section class="panel status-card"><div class="status-icon">${icon('lock', 22)}</div><div><p class="eyebrow">DATABASE</p><h3>Supabase connected</h3><p>${state.leads.length} leads, ${state.clients.length} clients and ${state.profiles.length} team profiles are loaded from the shared cloud database.</p></div></section><section class="panel status-card"><div class="status-icon">${icon('team', 22)}</div><div><p class="eyebrow">ACCESS</p><h3>Admin and Team Member roles</h3><p>Administrators see the complete company workspace. Team Members see only assigned records and never receive payment tables or client financial records.</p></div></section></div><section class="panel"><div class="panel-header"><div><p class="eyebrow">REAL SPREADSHEET DATA</p><h3>Google Sheets synchronization</h3><p>The included Apps Script detects the actual header row (currently row 3), adds a stable CRM ID column and preserves your existing dropdown colours and formatting.</p></div><span class="badge ${state.config.sheetsConfigured ? 'badge-blue' : 'badge-dark'}">${state.config.sheetsConfigured ? 'Configured' : 'Not configured'}</span></div><div class="sync-steps"><div class="sync-step"><span>1</span><p>Paste <strong>google-apps-script/Code.gs</strong> into your existing leads spreadsheet.</p></div><div class="sync-step"><span>2</span><p>Add the same shared secret in Apps Script and Netlify.</p></div><div class="sync-step"><span>3</span><p>Test the connection, then preview the real rows before importing.</p></div><div class="sync-step"><span>4</span><p>Use Sync to Sheet to update values without deleting the design or dropdowns.</p></div></div><div class="sync-actions"><button class="btn btn-secondary" data-action="sheets-test" ${state.config.sheetsConfigured ? '' : 'disabled'}>${icon('activity')} Test connection</button><button class="btn btn-primary" data-action="sheets-preview" ${state.config.sheetsConfigured ? '' : 'disabled'}>${icon('download')} Preview & import real data</button><button class="btn btn-dark" data-action="sheets-push" ${state.config.sheetsConfigured ? '' : 'disabled'}>${icon('upload')} Sync CRM to Sheet</button></div><div id="sync-result" class="sync-result">${lastSync ? `<div class="sync-message">Last ${esc(lastSync.direction)} sync: ${fmtDate(lastSync.created_at, true)} · ${esc(lastSync.status)} · ${lastSync.imported_count || 0} imported, ${lastSync.updated_count || 0} updated.</div>` : ''}</div></section><br><section class="panel"><div class="panel-header"><div><p class="eyebrow">NETLIFY</p><h3>Required environment variables</h3></div></div><div class="env-list"><code>SUPABASE_URL</code><code>SUPABASE_PUBLISHABLE_KEY</code><code>SUPABASE_SECRET_KEY</code><code>SUPABASE_SERVICE_ROLE_KEY (legacy alternative)</code><code>GOOGLE_SHEETS_WEB_APP_URL</code><code>GOOGLE_SHEETS_SHARED_SECRET</code></div><p class="helper" style="margin-top:12px">The Supabase secret key and Sheets secret stay only in Netlify Functions. They are never sent to the browser.</p></section>`
}

function openModal(title, body, wide = false) { modalRoot.innerHTML = `<div class="modal-backdrop" data-action="modal-close"><section class="modal ${wide ? 'wide' : ''}" data-modal-panel><header class="modal-header"><div><p class="eyebrow">VIREON LEAD HUB</p><h2>${esc(title)}</h2></div><button class="icon-btn" data-action="modal-close">${icon('close')}</button></header><div class="modal-body">${body}</div></section></div>` }
function closeModal() { modalRoot.innerHTML = '' }
function formObject(form) { const data = {}; new FormData(form).forEach((value, key) => { data[key] = value }); form.querySelectorAll('input[type="checkbox"]').forEach(input => { data[input.name] = input.checked }); return data }

function leadFormHtml(lead = {}) {
  const requirement = requirementFor(lead.id) || {}
  return `<form id="lead-form" class="form" data-id="${attr(lead.id || '')}"><div id="lead-form-message"></div><section class="form-section"><div class="form-section-title"><div><p class="eyebrow">CONTACT</p><h3>Lead and pipeline</h3></div></div><div class="form-grid three"><label><span>Company / lead name *</span><input name="company_name" value="${attr(lead.company_name || '')}" required autofocus></label><label><span>Contact person</span><input name="contact_person" value="${attr(lead.contact_person || '')}"></label><label><span>Business type</span><select name="industry"><option value="">Select</option>${optionList(INDUSTRIES, lead.industry)}</select></label><label><span>Phone</span><input name="phone" value="${attr(lead.phone || '')}"></label><label><span>WhatsApp</span><input name="whatsapp" value="${attr(lead.whatsapp || '')}"></label><label><span>Email</span><input name="email" type="email" value="${attr(lead.email || '')}"></label><label><span>Lead source</span><select name="lead_source"><option value="">Select</option>${optionList(SOURCES, lead.lead_source)}</select></label>${isAdmin() ? `<label><span>Assigned teammate</span><select name="assigned_to"><option value="">Unassigned</option>${state.profiles.filter(profile => profile.is_active !== false).map(profile => `<option value="${profile.id}" ${lead.assigned_to === profile.id ? 'selected' : ''}>${esc(profile.full_name)}</option>`).join('')}</select></label>` : ''}<label><span>Pipeline stage</span><select name="stage">${optionList(STAGES, lead.stage || 'new')}</select></label><label><span>Priority</span><select name="priority">${optionList(PRIORITIES, lead.priority || 'medium')}</select></label><label><span>Estimated budget (NPR)</span><input name="estimated_budget" type="number" min="0" value="${attr(lead.estimated_budget ?? '')}"></label><label><span>Expected monthly value</span><input name="expected_monthly_value" type="number" min="0" value="${attr(lead.expected_monthly_value ?? '')}"></label><label><span>Next follow-up date/time</span><input name="next_follow_up_at" type="datetime-local" value="${attr(toDateTimeInput(lead.next_follow_up_at))}"></label><label><span>Follow-up note</span><input name="next_follow_up_note" value="${attr(lead.next_follow_up_note || '')}" placeholder="call Sunday / send proposal in email"></label></div></section><section class="form-section"><div class="form-section-title"><div><p class="eyebrow">SMART ENTRY</p><h3>Paste rough notes</h3></div><button class="btn btn-secondary btn-sm" type="button" data-action="smart-parse">Parse notes</button></div><textarea name="rough_note" rows="3" placeholder="Talked on phone. Needs 12–15 videos monthly, budget around 20,000. Send proposal then schedule meeting."></textarea></section><section class="form-section"><div class="form-section-title"><div><p class="eyebrow">REQUIREMENTS</p><h3>What they need</h3></div></div><div class="form-grid three"><label><span>Videos monthly</span><input name="monthly_videos" type="number" min="0" value="${attr(requirement.monthly_videos ?? '')}"></label><label><span>Graphics monthly</span><input name="monthly_graphics" type="number" min="0" value="${attr(requirement.monthly_graphics ?? '')}"></label><label><span>Shoot frequency</span><input name="shoot_frequency" value="${attr(requirement.shoot_frequency || '')}"></label><label><span>Posting requirements</span><input name="posting_requirements" value="${attr(requirement.posting_requirements || '')}"></label><label><span>Approximate budget</span><input name="approximate_budget" type="number" min="0" value="${attr(requirement.approximate_budget ?? '')}"></label><label><span>Competitor / references</span><input name="competitor_references" value="${attr(requirement.competitor_references || '')}"></label></div><div class="check-grid"><label class="check-card"><input name="models_required" type="checkbox" ${checked(requirement.models_required)}><span>Models</span></label><label class="check-card"><input name="voiceover_required" type="checkbox" ${checked(requirement.voiceover_required)}><span>Voice-over</span></label><label class="check-card"><input name="video_editing_required" type="checkbox" ${checked(requirement.video_editing_required)}><span>Video editing</span></label><label class="check-card"><input name="content_creator_required" type="checkbox" ${checked(requirement.content_creator_required)}><span>Content creator</span></label><label class="check-card"><input name="social_media_handling_required" type="checkbox" ${checked(requirement.social_media_handling_required)}><span>Social handling</span></label></div><label><span>Current situation / remarks</span><textarea name="remarks" rows="3">${esc(lead.remarks || '')}</textarea></label><label><span>Special expectations</span><textarea name="special_expectations" rows="2">${esc(requirement.special_expectations || '')}</textarea></label></section><details class="form-section"><summary>Scoring, links and advanced details</summary><br><div class="form-grid three"><label><span>Engagement (0–5)</span><input name="engagement_level" type="number" min="0" max="5" value="${attr(lead.engagement_level ?? 2)}"></label><label><span>Meeting interest (0–5)</span><input name="meeting_interest" type="number" min="0" max="5" value="${attr(lead.meeting_interest ?? 0)}"></label><label><span>Urgency (0–5)</span><input name="urgency_level" type="number" min="0" max="5" value="${attr(lead.urgency_level ?? 0)}"></label><label><span>Requirements complete (%)</span><input name="requirements_completeness" type="number" min="0" max="100" value="${attr(lead.requirements_completeness ?? 0)}"></label><label class="check-card"><input name="decision_maker_contacted" type="checkbox" ${checked(lead.decision_maker_contacted)}><span>Decision-maker contacted</span></label><label><span>Closing probability (%)</span><input name="closing_probability" type="number" min="0" max="100" value="${attr(lead.closing_probability ?? '')}"></label><label><span>Date first contacted</span><input name="date_first_contacted" type="datetime-local" value="${attr(toDateTimeInput(lead.date_first_contacted))}"></label><label><span>Website</span><input name="website" value="${attr(lead.website || '')}"></label><label><span>Instagram</span><input name="instagram" value="${attr(lead.instagram || '')}"></label><label><span>Proposal link</span><input name="proposal_url" value="${attr(lead.proposal_url || '')}"></label><label><span>Google Drive folder</span><input name="drive_folder_url" value="${attr(lead.drive_folder_url || '')}"></label></div></details><div class="form-actions"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancel</button><button class="btn btn-primary" type="submit">${lead.id ? 'Save changes' : 'Add lead'}</button></div></form>`
}

function activityFormHtml(leadId = '', clientId = '') { return `<form id="activity-form" class="form" data-lead="${attr(leadId)}" data-client="${attr(clientId)}"><label><span>Activity type</span><select name="type">${optionList(['call', 'whatsapp', 'email', 'physical_meeting', 'online_meeting', 'proposal', 'follow_up', 'payment', 'internal_note'], 'call')}</select></label><label><span>Short summary *</span><input name="summary" required autofocus></label><label><span>Details / client response</span><textarea name="details" rows="4"></textarea></label><label><span>Next action</span><input name="next_action" placeholder="Send revised proposal"></label><label><span>Next follow-up</span><input name="next_follow_up_at" type="datetime-local"></label><div class="form-actions"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancel</button><button class="btn btn-primary">Save activity</button></div></form>` }
function taskFormHtml(leadId = '', clientId = '') { return `<form id="task-form" class="form"><label><span>Task title *</span><input name="title" required autofocus></label><div class="form-grid two"><label><span>Related lead</span><select name="lead_id"><option value="">None</option>${state.leads.map(lead => `<option value="${lead.id}" ${lead.id === leadId ? 'selected' : ''}>${esc(lead.company_name)}</option>`).join('')}</select></label><label><span>Related client</span><select name="client_id"><option value="">None</option>${state.clients.map(client => `<option value="${client.id}" ${client.id === clientId ? 'selected' : ''}>${esc(client.company_name)}</option>`).join('')}</select></label><label><span>Due date and time</span><input name="due_at" type="datetime-local"></label><label><span>Priority</span><select name="priority">${optionList(PRIORITIES, 'high')}</select></label>${isAdmin() ? `<label><span>Assign to</span><select name="assigned_to"><option value="">Unassigned</option>${state.profiles.filter(profile => profile.is_active !== false).map(profile => `<option value="${profile.id}">${esc(profile.full_name)}</option>`).join('')}</select></label>` : ''}</div><label><span>Description</span><textarea name="description" rows="3"></textarea></label><div class="form-actions"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancel</button><button class="btn btn-primary">Create task</button></div></form>` }

function clientFormHtml(client = {}, lead = null) {
  const fin = financialFor(client.id) || {}
  return `<form id="client-form" class="form" data-id="${attr(client.id || '')}" data-lead="${attr(lead?.id || '')}"><section class="form-section"><div class="form-grid three"><label><span>Company name *</span><input name="company_name" required value="${attr(client.company_name || lead?.company_name || '')}"></label><label><span>Contact person</span><input name="contact_person" value="${attr(client.contact_person || lead?.contact_person || '')}"></label><label><span>Industry</span><input name="industry" value="${attr(client.industry || lead?.industry || '')}"></label><label><span>Phone</span><input name="phone" value="${attr(client.phone || lead?.phone || '')}"></label><label><span>Email</span><input name="email" value="${attr(client.email || lead?.email || '')}"></label><label><span>Status</span><select name="status">${optionList(CLIENT_STATUSES, client.status || 'active')}</select></label><label><span>Package name</span><input name="package_name" value="${attr(client.package_name || '')}"></label><label><span>Monthly fee (NPR) *</span><input name="monthly_fee" type="number" min="0" value="${attr(fin.monthly_fee ?? lead?.expected_monthly_value ?? lead?.estimated_budget ?? 0)}" required></label><label><span>Billing cycle</span><select name="billing_cycle">${optionList(['monthly', 'quarterly', 'one_time'], fin.billing_cycle || 'monthly')}</select></label><label><span>Contract start</span><input name="contract_start" type="date" value="${attr(String(client.contract_start || '').slice(0, 10))}"></label><label><span>Contract end</span><input name="contract_end" type="date" value="${attr(String(client.contract_end || '').slice(0, 10))}"></label><label><span>Renewal / payment date</span><input name="renewal_date" type="date" value="${attr(String(client.renewal_date || '').slice(0, 10))}"></label><label><span>Account manager</span><select name="account_manager"><option value="">Unassigned</option>${state.profiles.filter(profile => profile.is_active !== false).map(profile => `<option value="${profile.id}" ${client.account_manager === profile.id ? 'selected' : ''}>${esc(profile.full_name)}</option>`).join('')}</select></label><label><span>Approval contact</span><input name="approval_contact" value="${attr(client.approval_contact || '')}"></label><label><span>Payment terms</span><input name="payment_terms" value="${attr(fin.payment_terms || '')}" placeholder="Due on the 1st of each month"></label></div></section><label><span>Services included — comma separated</span><input name="services" value="${attr((client.services || []).join(', '))}" placeholder="Video production, graphics, posting, models"></label><label><span>Scope summary / what Vireon promised</span><textarea name="scope_summary" rows="4">${esc(client.scope_summary || '')}</textarea></label><div class="form-grid two"><label><span>Google Drive folder</span><input name="drive_folder_url" value="${attr(client.drive_folder_url || lead?.drive_folder_url || '')}"></label><label><span>Contract link</span><input name="contract_url" value="${attr(client.contract_url || '')}"></label></div><label><span>Internal notes</span><textarea name="notes" rows="2">${esc(client.notes || '')}</textarea></label><div class="form-actions"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancel</button><button class="btn btn-primary">${lead ? 'Create client workspace' : 'Save client'}</button></div></form>`
}

function cycleFormHtml(clientId) { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); const label = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(now); return `<form id="cycle-form" class="form" data-client="${clientId}"><label><span>Cycle label</span><input name="label" value="${attr(label)}" required></label><div class="form-grid two"><label><span>Start date</span><input name="period_start" type="date" value="${dateOnly(start)}" required></label><label><span>End date</span><input name="period_end" type="date" value="${dateOnly(end)}" required></label><label><span>Status</span><select name="status">${optionList(CYCLE_STATUSES, 'active')}</select></label></div><label><span>Notes</span><textarea name="notes" rows="2"></textarea></label><div class="form-actions"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancel</button><button class="btn btn-primary">Create cycle</button></div></form>` }
function deliverableFormHtml(clientId) { const cycle = selectedCycle(clientId); return `<form id="deliverable-form" class="form" data-client="${clientId}"><label><span>Deliverable name *</span><input name="title" placeholder="Trainer-led educational videos" required autofocus></label><div class="form-grid two"><label><span>Category</span><select name="category">${optionList(['Video', 'Graphic', 'Shoot', 'Script', 'Posting', 'Model-led Content', 'Strategy', 'Other'], 'Video')}</select></label><label><span>Quantity</span><input name="quantity" type="number" min="1" value="1"></label><label><span>Monthly cycle</span><select name="cycle_id"><option value="">No cycle</option>${state.cycles.filter(item => item.client_id === clientId).map(item => `<option value="${item.id}" ${cycle?.id === item.id ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}</select></label><label><span>Due date</span><input name="due_date" type="date" value="${attr(cycle?.period_end || '')}"></label><label><span>Assigned teammate</span><select name="assigned_to"><option value="">Unassigned</option>${state.profiles.filter(profile => profile.is_active !== false).map(profile => `<option value="${profile.id}">${esc(profile.full_name)}</option>`).join('')}</select></label></div><label><span>Notes</span><textarea name="notes" rows="2"></textarea></label><div class="form-actions"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancel</button><button class="btn btn-primary">Add work</button></div></form>` }
function shootFormHtml(clientId) { const cycle = selectedCycle(clientId); return `<form id="shoot-form" class="form" data-client="${clientId}"><label><span>Shoot title *</span><input name="title" value="Content shoot" required></label><div class="form-grid two"><label><span>Date and time *</span><input name="scheduled_at" type="datetime-local" required></label><label><span>Duration (minutes)</span><input name="duration_minutes" type="number" min="15" step="15" value="120"></label><label><span>Location</span><input name="location"></label><label><span>Status</span><select name="status">${optionList(SHOOT_STATUSES, 'planned')}</select></label><label><span>Monthly cycle</span><select name="cycle_id"><option value="">No cycle</option>${state.cycles.filter(item => item.client_id === clientId).map(item => `<option value="${item.id}" ${cycle?.id === item.id ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}</select></label><label><span>Assigned teammate</span><select name="assigned_to"><option value="">Unassigned</option>${state.profiles.filter(profile => profile.is_active !== false).map(profile => `<option value="${profile.id}">${esc(profile.full_name)}</option>`).join('')}</select></label></div><label><span>Notes</span><textarea name="notes" rows="2"></textarea></label><div class="form-actions"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancel</button><button class="btn btn-primary">Schedule shoot</button></div></form>` }
function paymentFormHtml(clientId) { const client = state.clients.find(item => item.id === clientId); const fin = financialFor(clientId); return `<form id="payment-form" class="form" data-client="${clientId}"><label><span>Description</span><input name="description" value="${attr(client?.package_name || 'Monthly package')}"></label><div class="form-grid two"><label><span>Amount (NPR)</span><input name="amount" type="number" min="0" value="${attr(fin?.monthly_fee || 0)}"></label><label><span>Due date</span><input name="due_date" type="date"></label><label><span>Status</span><select name="status">${optionList(PAYMENT_STATUSES, 'upcoming')}</select></label><label><span>Payment method</span><input name="payment_method"></label></div><label><span>Notes</span><textarea name="notes" rows="2"></textarea></label><div class="form-actions"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancel</button><button class="btn btn-primary">Add payment</button></div></form>` }
function replyFormHtml(item = {}) { return `<form id="reply-form" class="form" data-id="${attr(item.id || '')}"><label><span>Title *</span><input name="title" value="${attr(item.title || '')}" required></label><div class="form-grid two"><label><span>Category</span><select name="category">${optionList(['Requirements Request', 'Proposal Sent', 'Follow-up', 'Meeting Scheduling', 'Thank You', 'Payment Reminder', 'Onboarding', 'General'], item.category || 'Follow-up')}</select></label><label><span>Language</span><select name="language">${optionList(['English', 'Nepali', 'Roman Nepali'], item.language || 'English')}</select></label></div><label><span>Message *</span><textarea name="message_body" rows="8" required>${esc(item.message_body || '')}</textarea></label><p class="helper">Placeholders: {{company_name}}, {{contact_name}}, {{proposal_link}}, {{meeting_time}}</p><label class="check-card"><input name="is_favorite" type="checkbox" ${checked(item.is_favorite)}><span>Favorite reply</span></label><div class="form-actions">${item.id ? `<button type="button" class="btn btn-danger" data-action="reply-delete" data-id="${item.id}">Delete</button>` : ''}<button type="button" class="btn btn-ghost" data-action="modal-close">Cancel</button><button class="btn btn-primary">Save reply</button></div></form>` }
function teamFormHtml() { return `<form id="team-form" class="form"><div class="form-grid two"><label><span>Full name *</span><input name="full_name" required autofocus></label><label><span>Job title</span><input name="job_title" placeholder="Video Editor"></label><label><span>Email *</span><input name="email" type="email" required></label><div class="form-message"><strong>Team Member access</strong><br>This account will see only work assigned to it. Administrator access remains limited to your personal account.</div><label><span>Temporary password *</span><input name="password" type="password" minlength="8" required></label></div><p class="helper">Share the temporary password privately. The teammate can change it after signing in.</p><div class="form-actions"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancel</button><button class="btn btn-primary">Create account</button></div></form>` }
function passwordFormHtml(userId = state.profile.id, title = 'Change password') { return `<form id="password-form" class="form" data-user="${attr(userId)}"><label><span>${esc(title)}</span><input name="password" type="password" minlength="8" required autofocus></label><label><span>Confirm password</span><input name="confirm_password" type="password" minlength="8" required></label><div class="form-actions"><button type="button" class="btn btn-ghost" data-action="modal-close">Cancel</button><button class="btn btn-primary">Update password</button></div></form>` }

const SHEET_ALIASES = {
  'lead name': 'company_name', 'company name': 'company_name', 'contact number': 'phone', phone: 'phone', email: 'email', 'business type': 'industry', industry: 'industry', 'lead source': 'lead_source', 'date first contacted': 'date_first_contacted', 'current situation / remarks': 'remarks', 'current situation/remarks': 'remarks', remarks: 'remarks', 'lead status': 'sheet_status_text', priority: 'priority', 'next follow-up date': 'next_follow_up_raw', 'expected monthly value': 'expected_monthly_value', score: 'score', 'crm id': 'crm_id',
}
const SHEET_STAGE_MAP = {
  negotiating: 'negotiating', negotiation: 'negotiating', 'to call': 'contacted', 'call again': 'follow_up', contacted: 'contacted',
  requirements: 'requirements', 'requirements collected': 'requirements', 'proposal preparing': 'proposal_preparing', 'preparing proposal': 'proposal_preparing',
  'proposal sent': 'proposal_sent', 'proposal shared': 'proposal_sent', 'waiting response': 'follow_up', 'waiting for response': 'follow_up', 'follow up': 'follow_up', 'follow-up': 'follow_up',
  meeting: 'meeting', 'meeting scheduled': 'meeting', 'not priority': 'on_hold', 'on hold': 'on_hold', 'no deal': 'lost', lost: 'lost', rejected: 'lost', won: 'won', signed: 'won', 'new lead': 'new',
}
function mapSheetRow(row) {
  const mapped = { stage: 'new', priority: 'medium', sheet_row_number: Number(row._rowNumber || 0) || null, sheet_last_synced_at: todayIso() }
  Object.entries(row).forEach(([header, value]) => {
    const key = SHEET_ALIASES[String(header).trim().toLowerCase()]
    if (!key || value === null || value === undefined || value === '') return
    if (key === 'priority') { const p = String(value).toLowerCase(); mapped.priority = p.includes('urgent') ? 'urgent' : p.includes('high') ? 'high' : p.includes('low') ? 'low' : 'medium' }
    else if (key === 'date_first_contacted') { const date = parseDateValue(value); if (date) mapped.date_first_contacted = date.toISOString() }
    else if (key === 'next_follow_up_raw') { const date = parseDateValue(value); if (date) mapped.next_follow_up_at = date.toISOString(); mapped.next_follow_up_note = String(value).trim() }
    else if (key === 'sheet_status_text') { mapped.sheet_status_text = String(value).trim(); mapped.stage = SHEET_STAGE_MAP[String(value).trim().toLowerCase()] || 'new' }
    else if (['expected_monthly_value', 'score'].includes(key)) mapped[key] = Number(String(value).replace(/[^0-9.]/g, '')) || 0
    else if (key === 'crm_id') mapped.crm_id = String(value).trim()
    else mapped[key] = String(value).trim()
  })
  if (!mapped.company_name) return null
  mapped.last_activity_at = mapped.date_first_contacted || todayIso()
  mapped.score = mapped.score || calculateScore(mapped).total
  return mapped
}

function buildSheetPreview(rows) {
  return rows.map(row => {
    const mapped = mapSheetRow(row)
    if (!mapped) return { row, mapped: null, action: 'skip', reason: 'No lead name' }
    const crmMatch = isUuid(mapped.crm_id) ? state.leads.find(lead => lead.id === mapped.crm_id) : null
    if (crmMatch) return { row, mapped, action: 'update', existing: crmMatch, reason: 'Matched by CRM ID' }
    const phone = normalizePhone(mapped.phone); const email = normalizeEmail(mapped.email)
    const exact = state.leads.find(lead => (phone && normalizePhone(lead.phone) === phone) || (email && normalizeEmail(lead.email) === email))
    if (exact) return { row, mapped, action: 'update', existing: exact, reason: phone && normalizePhone(exact.phone) === phone ? 'Matched by phone' : 'Matched by email' }
    const companyMatches = state.leads.filter(lead => normalizeText(lead.company_name) === normalizeText(mapped.company_name))
    if (companyMatches.length && !phone && !email) return { row, mapped, action: 'review', existing: companyMatches[0], reason: 'Same company name, no phone/email' }
    return { row, mapped, action: 'create', reason: companyMatches.length ? 'New contact under an existing company name' : 'New lead' }
  })
}

function sheetPreviewHtml(preview) {
  const counts = preview.reduce((acc, item) => { acc[item.action] = (acc[item.action] || 0) + 1; return acc }, {})
  return `<div class="preview-summary"><article><strong>${counts.create || 0}</strong><span>New leads</span></article><article><strong>${counts.update || 0}</strong><span>Updates</span></article><article><strong>${counts.review || 0}</strong><span>Needs review</span></article><article><strong>${counts.skip || 0}</strong><span>Skipped</span></article></div><div class="table-wrap"><table><thead><tr><th>Sheet row</th><th>Lead</th><th>Action</th><th>Reason</th></tr></thead><tbody>${preview.map((item, index) => `<tr><td>${item.row._rowNumber || '—'}</td><td><strong>${esc(item.mapped?.company_name || 'Blank row')}</strong><small>${esc(item.mapped?.phone || item.mapped?.email || '')}</small></td><td>${item.action === 'review' ? `<select class="inline-select" data-action="sheet-review-action" data-index="${index}"><option value="review" selected>Review</option><option value="create">Import as new</option><option value="update">Update match</option><option value="skip">Skip</option></select>` : `<span class="badge ${item.action === 'create' ? 'badge-blue' : item.action === 'update' ? 'badge-line' : 'badge-soft'}">${esc(item.action)}</span>`}</td><td>${esc(item.reason)}</td></tr>`).join('')}</tbody></table></div><p class="helper" style="margin-top:12px">Exact CRM ID, phone or email matches are updated. A repeated company name with a different contact can remain a separate lead.</p><div class="form-actions"><button class="btn btn-ghost" data-action="modal-close">Cancel</button><button class="btn btn-primary" data-action="sheets-apply">Import approved rows</button></div>`
}

function sheetStatusForStage(stage) { return ({ new: 'To call', contacted: 'To call', requirements: 'Negotiating', proposal_preparing: 'Negotiating', proposal_sent: 'waiting response', follow_up: 'waiting response', meeting: 'Negotiating', negotiating: 'Negotiating', won: 'Won', lost: 'No deal', on_hold: 'not priority' })[stage] || stageLabel(stage) }
function leadsForSheet() {
  return state.leads.map(lead => ({
    'Lead Name': lead.company_name,
    'Contact Number': lead.phone || '',
    'Email': lead.email || '',
    'Business Type': lead.industry || '',
    'Lead Source': lead.lead_source || '',
    'Date First Contacted': fmtSheetDate(lead.date_first_contacted),
    'Current Situation / Remarks': lead.remarks || '',
    'Lead Status': sheetStatusForStage(lead.stage),
    'Priority': humanize(lead.priority),
    'Next Follow-up Date': lead.next_follow_up_at ? fmtSheetDate(lead.next_follow_up_at) : (lead.next_follow_up_note || ''),
    'Expected Monthly Value': lead.expected_monthly_value || '',
    'Score': lead.score || calculateScore(lead).total,
    'CRM ID': lead.id,
  }))
}

async function functionCall(name, payload, retried = false) {
  if (!state.session?.access_token) throw new Error('Sign in again.')
  let response = await fetch(`/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.session.access_token}` }, body: JSON.stringify(payload) })
  if (response.status === 401 && state.session.refresh_token && !retried) {
    await refreshSession()
    return functionCall(name, payload, true)
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result.ok === false) throw new Error(result.error || result.message || 'Request failed.')
  return result
}
async function sheetsCall(action, payload = {}) { return functionCall('google-sheets-sync', { action, ...payload }) }
function setSyncResult(message, error = false) { const element = document.getElementById('sync-result'); if (element) element.innerHTML = `<div class="sync-message">${error ? '<strong>Could not sync.</strong><br>' : ''}${esc(message)}</div>` }

async function saveLeadFromForm(form) {
  const raw = formObject(form)
  const id = form.dataset.id || null
  const reqKeys = ['monthly_videos', 'monthly_graphics', 'shoot_frequency', 'posting_requirements', 'approximate_budget', 'competitor_references', 'models_required', 'voiceover_required', 'video_editing_required', 'content_creator_required', 'social_media_handling_required', 'special_expectations']
  const requirement = {}; reqKeys.forEach(key => { requirement[key] = raw[key]; delete raw[key] })
  delete raw.rough_note
  raw.assigned_to = isAdmin() ? (raw.assigned_to || null) : (state.leads.find(lead => lead.id === id)?.assigned_to || state.profile.id)
  raw.next_follow_up_at = raw.next_follow_up_at ? new Date(raw.next_follow_up_at).toISOString() : null
  raw.date_first_contacted = raw.date_first_contacted ? new Date(raw.date_first_contacted).toISOString() : (id ? state.leads.find(lead => lead.id === id)?.date_first_contacted : todayIso())
  raw.estimated_budget = numOrNull(raw.estimated_budget); raw.expected_monthly_value = numOrNull(raw.expected_monthly_value); raw.closing_probability = numOrNull(raw.closing_probability)
  raw.meeting_interest = Number(raw.meeting_interest || 0); raw.urgency_level = Number(raw.urgency_level || 0); raw.engagement_level = Number(raw.engagement_level || 0); raw.requirements_completeness = Number(raw.requirements_completeness || 0); raw.decision_maker_contacted = Boolean(raw.decision_maker_contacted)
  raw.updated_at = todayIso(); raw.last_activity_at = state.leads.find(lead => lead.id === id)?.last_activity_at || todayIso(); raw.score = calculateScore(raw).total

  const duplicates = findDuplicates(raw, state.leads.filter(lead => lead.id !== id)).filter(match => match.confidence >= 60)
  if (duplicates.length && !form.dataset.duplicateConfirmed) {
    document.getElementById('lead-form-message').innerHTML = `<div class="duplicate-box"><strong>Possible duplicate</strong><p>${duplicates.slice(0, 3).map(match => `${esc(match.lead.company_name)} — ${esc(match.reasons.join(', '))}`).join('<br>')}</p><p>Submit again only if this is a separate record.</p></div>`
    form.dataset.duplicateConfirmed = 'true'; form.querySelector('button[type="submit"]').textContent = 'Save anyway'; return null
  }

  let saved
  if (id) saved = await updateRecord('leads', id, raw)
  else { requireAdmin(); saved = await insertRecord('leads', { ...raw, created_by: state.profile.id, assigned_to: raw.assigned_to || state.profile.id, created_at: todayIso() }) }
  await upsertRecord('lead_requirements', { lead_id: saved.id, monthly_videos: Number(requirement.monthly_videos || 0), monthly_graphics: Number(requirement.monthly_graphics || 0), shoot_frequency: requirement.shoot_frequency || null, posting_requirements: requirement.posting_requirements || null, approximate_budget: numOrNull(requirement.approximate_budget), competitor_references: requirement.competitor_references || null, models_required: Boolean(requirement.models_required), voiceover_required: Boolean(requirement.voiceover_required), video_editing_required: Boolean(requirement.video_editing_required), content_creator_required: Boolean(requirement.content_creator_required), social_media_handling_required: Boolean(requirement.social_media_handling_required), special_expectations: requirement.special_expectations || null }, 'lead_id')
  return saved
}

async function saveClientFromForm(form) {
  requireAdmin(); const raw = formObject(form); const clientId = form.dataset.id || null; const lead = state.leads.find(item => item.id === form.dataset.lead)
  const finance = { monthly_fee: Number(raw.monthly_fee || 0), billing_cycle: raw.billing_cycle || 'monthly', payment_terms: raw.payment_terms || null }
  delete raw.monthly_fee; delete raw.billing_cycle; delete raw.payment_terms
  const payload = { ...raw, services: String(raw.services || '').split(',').map(item => item.trim()).filter(Boolean), account_manager: raw.account_manager || null, updated_at: todayIso(), monthly_fee: 0, billing_cycle: 'monthly' }
  let client
  if (clientId) client = await updateRecord('clients', clientId, payload)
  else client = await insertRecord('clients', { ...payload, lead_id: lead?.id || null, created_by: state.profile.id, created_at: todayIso() })
  await upsertRecord('client_financials', { client_id: client.id, ...finance }, 'client_id')
  if (lead) {
    await updateRecord('leads', lead.id, { stage: 'won', closing_probability: 100, updated_at: todayIso(), last_activity_at: todayIso() })
    await insertRecord('activities', { lead_id: lead.id, client_id: client.id, type: 'stage_change', summary: 'Lead converted to signed client', details: `Client workspace created at ${fmtCurrency(finance.monthly_fee)} per ${finance.billing_cycle}.`, created_by: state.profile.id })
  }
  return client
}

async function applySheetImport() {
  requireAdmin(); assertOnline(); const preview = state.sheetPreview || []
  let imported = 0; let updated = 0; let skipped = 0; let conflicts = 0; const assignments = []
  for (const item of preview) {
    if (!item.mapped || item.action === 'skip' || item.action === 'review') { skipped++; if (item.action === 'review') conflicts++; continue }
    const mapped = { ...item.mapped }; delete mapped.crm_id
    try {
      let saved
      if (item.action === 'update' && item.existing) {
        const sheetFields = ['company_name', 'phone', 'email', 'industry', 'lead_source', 'date_first_contacted', 'remarks', 'stage', 'priority', 'next_follow_up_at', 'next_follow_up_note', 'sheet_status_text', 'sheet_row_number', 'sheet_last_synced_at', 'expected_monthly_value']
        const changes = {}; sheetFields.forEach(key => { if (mapped[key] !== undefined) changes[key] = mapped[key] })
        changes.score = calculateScore({ ...item.existing, ...changes }).total; changes.updated_at = todayIso()
        saved = await updateRecord('leads', item.existing.id, changes); updated++
      } else {
        const insert = { ...mapped, id: isUuid(item.mapped.crm_id) ? item.mapped.crm_id : undefined, created_by: state.profile.id, assigned_to: state.profile.id, created_at: todayIso(), updated_at: todayIso() }
        Object.keys(insert).forEach(key => insert[key] === undefined && delete insert[key])
        saved = await insertRecord('leads', insert); imported++
      }
      if (item.row._rowNumber && String(item.row._crmId || '') !== saved.id) assignments.push({ rowNumber: item.row._rowNumber, crmId: saved.id })
    } catch (error) { conflicts++; console.error('Sheet row import failed', item.row._rowNumber, error) }
  }
  if (assignments.length) await sheetsCall('applyIds', { assignments })
  await insertRecord('sync_logs', { direction: 'sheet_to_crm', status: conflicts ? 'completed_with_conflicts' : 'completed', imported_count: imported, updated_count: updated, skipped_count: skipped, conflict_count: conflicts, details: { assignments: assignments.length }, created_by: state.profile.id })
  state.sheetPreview = null; closeModal(); await refreshAndRender('Real Sheet data imported'); toast('Import summary', `${imported} created, ${updated} updated, ${skipped} skipped, ${conflicts} conflicts.`)
}

async function handleAction(action, element) {
  if (!action) return
  if (action === 'reload') { location.reload(); return }
  if (action === 'menu-open') { state.menuOpen = true; document.getElementById('shell')?.classList.add('menu-open'); return }
  if (action === 'menu-close') { state.menuOpen = false; document.getElementById('shell')?.classList.remove('menu-open'); return }
  if (action === 'modal-close') { closeModal(); return }
  if (action === 'logout') { await logout(); return }
  if (action === 'password-change') { openModal('Change your password', passwordFormHtml()); return }
  if (action === 'export-leads') { exportLeadsCsv(); toast('Leads exported', 'The CSV is ready to open in Excel or Google Sheets.'); return }
  if (action === 'export-clients') { exportClientsCsv(); toast('Clients exported', 'The CSV includes administrator-only financial fields.'); return }
  if (action === 'lead-add') { requireAdmin(); openModal('Add lead', leadFormHtml(), true); return }
  if (action === 'lead-edit') { openModal('Edit lead', leadFormHtml(state.leads.find(item => item.id === element.dataset.id)), true); return }
  if (action === 'lead-delete') { requireAdmin(); const lead = state.leads.find(item => item.id === element.dataset.id); if (lead && confirm(`Delete ${lead.company_name}? This removes its requirements, tasks and lead history. Any signed-client workspace remains separate.`)) { await deleteRecord('leads', lead.id); location.hash = '#/leads'; await refreshAndRender('Lead deleted') } return }
  if (action === 'smart-parse') { const form = element.closest('form'); const parsed = smartParse(form.rough_note.value); if (parsed.budget) { form.estimated_budget.value = parsed.budget; form.approximate_budget.value = parsed.budget } if (parsed.videos) form.monthly_videos.value = parsed.videos; if (parsed.graphics) form.monthly_graphics.value = parsed.graphics; if (parsed.stage) form.stage.value = parsed.stage; if (parsed.cleaned) form.remarks.value = parsed.cleaned; toast('Notes parsed', 'Review the extracted fields before saving.'); return }
  if (action === 'activity-add') { openModal('Record activity', activityFormHtml(element.dataset.lead || '', element.dataset.client || '')); return }
  if (action === 'task-add') { openModal('Create task', taskFormHtml(element.dataset.lead || '', element.dataset.client || '')); return }
  if (action === 'task-complete') { await updateRecord('tasks', element.dataset.id, { status: 'completed', completed_at: todayIso() }); await refreshAndRender('Task completed'); return }
  if (action === 'task-delete') { requireAdmin(); if (confirm('Delete this task?')) { await deleteRecord('tasks', element.dataset.id); await refreshAndRender('Task deleted') } return }
  if (action === 'client-convert') { requireAdmin(); const lead = state.leads.find(item => item.id === element.dataset.lead); openModal('Create signed-client workspace', clientFormHtml({}, lead), true); return }
  if (action === 'client-add') { requireAdmin(); openModal('Add client', clientFormHtml(), true); return }
  if (action === 'client-edit') { requireAdmin(); openModal('Edit client', clientFormHtml(state.clients.find(item => item.id === element.dataset.id)), true); return }
  if (action === 'client-delete') { requireAdmin(); const client = state.clients.find(item => item.id === element.dataset.id); if (client && confirm(`Delete the complete ${client.company_name} client workspace? This removes its cycles, deliverables, shoots, payments and client-linked history.`)) { await deleteRecord('clients', client.id); location.hash = '#/clients'; await refreshAndRender('Client workspace deleted') } return }
  if (action === 'cycle-add') { requireAdmin(); openModal('Start a new delivery cycle', cycleFormHtml(element.dataset.client)); return }
  if (action === 'cycle-select') { state.filters.cycle = { ...(state.filters.cycle || {}), [element.dataset.client]: element.dataset.id }; renderApp(); return }
  if (action === 'deliverable-add') { requireAdmin(); openModal('Add promised work', deliverableFormHtml(element.dataset.client)); return }
  if (action === 'deliverable-delete') { requireAdmin(); if (confirm('Delete this deliverable?')) { await deleteRecord('deliverables', element.dataset.id); await refreshAndRender('Deliverable removed') } return }
  if (action === 'shoot-add') { requireAdmin(); openModal('Schedule a shoot', shootFormHtml(element.dataset.client)); return }
  if (action === 'shoot-delete') { requireAdmin(); if (confirm('Delete this shoot?')) { await deleteRecord('shoots', element.dataset.id); await refreshAndRender('Shoot removed') } return }
  if (action === 'payment-add') { requireAdmin(); openModal('Add payment record', paymentFormHtml(element.dataset.client)); return }
  if (action === 'payment-delete') { requireAdmin(); if (confirm('Delete this payment record?')) { await deleteRecord('payments', element.dataset.id); await refreshAndRender('Payment record deleted') } return }
  if (action === 'reply-add') { requireAdmin(); openModal('Add quick reply', replyFormHtml(), true); return }
  if (action === 'reply-edit') { requireAdmin(); openModal('Edit quick reply', replyFormHtml(state.quickReplies.find(item => item.id === element.dataset.id)), true); return }
  if (action === 'reply-delete') { requireAdmin(); if (confirm('Delete this quick reply?')) { await deleteRecord('quick_replies', element.dataset.id); closeModal(); await refreshAndRender('Quick reply deleted') } return }
  if (action === 'reply-copy') { const reply = state.quickReplies.find(item => item.id === element.dataset.id); await copyText(reply.message_body); if (isAdmin()) await updateRecord('quick_replies', reply.id, { usage_count: Number(reply.usage_count || 0) + 1, last_used_at: todayIso() }); toast('Reply copied', 'Personalize the name and details before sending.'); return }
  if (action === 'team-add') { requireAdmin(); openModal('Create team account', teamFormHtml()); return }
  if (action === 'team-reset') { requireAdmin(); openModal(`Reset password — ${element.dataset.name}`, passwordFormHtml(element.dataset.id, 'New temporary password')); return }
  if (action === 'team-deactivate') { requireAdmin(); if (confirm('Deactivate this account?')) { await functionCall('admin-users', { action: 'deactivate', userId: element.dataset.id }); await refreshAndRender('Account deactivated') } return }
  if (action === 'team-activate') { requireAdmin(); await functionCall('admin-users', { action: 'activate', userId: element.dataset.id }); await refreshAndRender('Account activated'); return }
  if (action === 'sheets-test') { requireAdmin(); setSyncResult('Testing the Google Sheets connection…'); const result = await sheetsCall('test'); setSyncResult(result.message); return }
  if (action === 'sheets-preview') { requireAdmin(); setSyncResult('Reading the current Google Sheet…'); const result = await sheetsCall('pull'); state.sheetPreview = buildSheetPreview(result.rows || []); setSyncResult(`Read ${result.count || 0} real rows from “${result.sheetName || 'Leads'}”. Review them before importing.`); openModal('Review real Google Sheets data', sheetPreviewHtml(state.sheetPreview), true); return }
  if (action === 'sheet-review-action') { const index = Number(element.dataset.index); if (state.sheetPreview?.[index]) state.sheetPreview[index].action = element.value; return }
  if (action === 'sheets-apply') { await applySheetImport(); return }
  if (action === 'sheets-push') { requireAdmin(); if (!confirm('Sync the current CRM values back to Google Sheets? Existing formatting is preserved, but matching row values will be updated.')) return; setSyncResult('Updating values in the Sheet without deleting its design…'); const result = await sheetsCall('push', { rows: leadsForSheet() }); await insertRecord('sync_logs', { direction: 'crm_to_sheet', status: 'completed', imported_count: Number(result.appended || 0), updated_count: Number(result.updated || 0), details: result, created_by: state.profile.id }); setSyncResult(result.message || 'Sheet synchronized.'); await loadAll(); return }
}

document.addEventListener('click', async event => {
  const element = event.target.closest('[data-action]')
  if (!element) return
  // Inputs and selects with data-action are handled by the change listener.
  // Do not prevent their native focus/dropdown behaviour.
  if (element.matches('input[data-action], select[data-action], textarea[data-action]')) return
  if (element.classList.contains('modal-backdrop') && event.target !== element) return
  event.preventDefault()
  try { await handleAction(element.dataset.action, element) } catch (error) { toast('Action failed', error.message || 'Please try again.', 'error'); setSyncResult(error.message || 'Sync failed.', true) }
})

let filterTimer

document.addEventListener('input', event => {
  const element = event.target
  const filter = element.dataset.filter
  if (!['lead-query', 'client-query', 'reply-query'].includes(filter)) return
  if (filter === 'lead-query') state.filters.leadQuery = element.value
  if (filter === 'client-query') state.filters.clientQuery = element.value
  if (filter === 'reply-query') state.filters.replyQuery = element.value
  clearTimeout(filterTimer)
  filterTimer = setTimeout(() => {
    const caret = element.selectionStart
    renderApp()
    const replacement = document.querySelector(`[data-filter="${filter}"]`)
    if (replacement) {
      replacement.focus()
      if (Number.isInteger(caret)) replacement.setSelectionRange(caret, caret)
    }
  }, 220)
})

document.addEventListener('change', async event => {
  const element = event.target
  try {
    if (element.dataset.filter === 'lead-stage') { state.filters.leadStage = element.value; if (route().query.has('stage')) location.hash = '#/leads'; else renderApp(); return }
    if (element.dataset.filter === 'lead-priority') { state.filters.leadPriority = element.value; renderApp(); return }
    if (element.dataset.filter === 'lead-industry') { state.filters.leadIndustry = element.value; renderApp(); return }
    if (element.dataset.action === 'deliverable-status') { await updateRecord('deliverables', element.dataset.id, { status: element.value }); await refreshAndRender('Work status updated'); return }
    if (element.dataset.action === 'deliverable-qty') { const item = state.deliverables.find(row => row.id === element.dataset.id); const quantity = clamp(element.value, 0, item.quantity); const status = quantity >= item.quantity ? 'delivered' : quantity > 0 ? 'in_progress' : 'not_started'; await updateRecord('deliverables', item.id, { completed_quantity: quantity, status }); await refreshAndRender('Completed quantity updated'); return }
    if (element.dataset.action === 'shoot-status') { await updateRecord('shoots', element.dataset.id, { status: element.value }); await refreshAndRender('Shoot status updated'); return }
    if (element.dataset.action === 'payment-status') { requireAdmin(); const changes = { status: element.value }; if (element.value === 'paid') changes.paid_at = todayIso(); await updateRecord('payments', element.dataset.id, changes); await refreshAndRender('Payment status updated'); return }
    if (element.dataset.action === 'sheet-review-action') { const index = Number(element.dataset.index); if (state.sheetPreview?.[index]) state.sheetPreview[index].action = element.value; return }
  } catch (error) { toast('Could not update', error.message, 'error') }
})

document.addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target
  try {
    if (form.id === 'login-form') {
      const button = form.querySelector('button[type="submit"]'); const errorBox = document.getElementById('login-error'); button.disabled = true; button.textContent = 'Signing in…'; errorBox.textContent = ''
      try { await login(form.email.value, form.password.value); location.hash = '#/dashboard'; renderApp() } catch (error) { errorBox.textContent = error.message; button.disabled = false; button.textContent = 'Sign in' }
      return
    }
    assertOnline()
    if (form.id === 'lead-form') { const saved = await saveLeadFromForm(form); if (!saved) return; closeModal(); await loadAll(); location.hash = `#/leads/${saved.id}`; renderApp(); toast(form.dataset.id ? 'Lead updated' : 'Lead added'); return }
    if (form.id === 'activity-form') { const data = formObject(form); data.lead_id = form.dataset.lead || null; data.client_id = form.dataset.client || null; data.next_follow_up_at = data.next_follow_up_at ? new Date(data.next_follow_up_at).toISOString() : null; data.created_by = state.profile.id; await insertRecord('activities', data); if (data.lead_id && data.next_follow_up_at) await updateRecord('leads', data.lead_id, { next_follow_up_at: data.next_follow_up_at, last_activity_at: todayIso(), updated_at: todayIso() }); if (data.next_action) await insertRecord('tasks', { lead_id: data.lead_id, client_id: data.client_id, title: data.next_action, due_at: data.next_follow_up_at, priority: 'high', status: 'pending', assigned_to: state.profile.id, created_by: state.profile.id }); closeModal(); await refreshAndRender('Activity recorded'); return }
    if (form.id === 'task-form') { const data = formObject(form); data.lead_id = data.lead_id || null; data.client_id = data.client_id || null; data.assigned_to = isAdmin() ? (data.assigned_to || state.profile.id) : state.profile.id; data.due_at = data.due_at ? new Date(data.due_at).toISOString() : null; data.status = 'pending'; data.created_by = state.profile.id; await insertRecord('tasks', data); closeModal(); await refreshAndRender('Task created'); return }
    if (form.id === 'client-form') { const client = await saveClientFromForm(form); closeModal(); await loadAll(); location.hash = `#/clients/${client.id}`; renderApp(); toast(form.dataset.lead ? 'Client workspace created' : 'Client saved'); return }
    if (form.id === 'cycle-form') { requireAdmin(); const data = formObject(form); await insertRecord('client_cycles', { ...data, client_id: form.dataset.client, created_by: state.profile.id }); closeModal(); await refreshAndRender('Monthly cycle created'); return }
    if (form.id === 'deliverable-form') { requireAdmin(); const data = formObject(form); await insertRecord('deliverables', { ...data, client_id: form.dataset.client, cycle_id: data.cycle_id || null, assigned_to: data.assigned_to || null, quantity: Number(data.quantity || 1), completed_quantity: 0, status: 'not_started', period_label: state.cycles.find(item => item.id === data.cycle_id)?.label || null }); closeModal(); await refreshAndRender('Deliverable added'); return }
    if (form.id === 'shoot-form') { requireAdmin(); const data = formObject(form); await insertRecord('shoots', { ...data, client_id: form.dataset.client, cycle_id: data.cycle_id || null, assigned_to: data.assigned_to || null, duration_minutes: numOrNull(data.duration_minutes), scheduled_at: new Date(data.scheduled_at).toISOString(), created_by: state.profile.id }); closeModal(); await refreshAndRender('Shoot scheduled'); return }
    if (form.id === 'payment-form') { requireAdmin(); const data = formObject(form); await insertRecord('payments', { ...data, client_id: form.dataset.client, amount: Number(data.amount || 0), paid_at: data.status === 'paid' ? todayIso() : null }); closeModal(); await refreshAndRender('Payment record added'); return }
    if (form.id === 'reply-form') { requireAdmin(); const data = formObject(form); const id = form.dataset.id; data.is_favorite = Boolean(data.is_favorite); if (id) await updateRecord('quick_replies', id, data); else await insertRecord('quick_replies', { ...data, usage_count: 0, is_archived: false, created_by: state.profile.id }); closeModal(); await refreshAndRender('Quick reply saved'); return }
    if (form.id === 'team-form') { requireAdmin(); const data = formObject(form); await functionCall('admin-users', { action: 'create', email: data.email, password: data.password, fullName: data.full_name, jobTitle: data.job_title, role: 'member' }); closeModal(); await refreshAndRender('Team account created'); return }
    if (form.id === 'password-form') { const data = formObject(form); if (data.password !== data.confirm_password) throw new Error('Passwords do not match.'); if (data.password.length < 8) throw new Error('Use at least 8 characters.'); if (form.dataset.user === state.profile.id) { const response = await authRequest('user', { method: 'PUT', headers: { Authorization: `Bearer ${state.session.access_token}` }, body: JSON.stringify({ password: data.password }) }); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || 'Could not change password.') } } else { requireAdmin(); await functionCall('admin-users', { action: 'resetPassword', userId: form.dataset.user, password: data.password }) } closeModal(); toast('Password updated'); return }
  } catch (error) { toast('Could not save', error.message || 'Please check the form.', 'error') }
})

window.addEventListener('hashchange', () => { state.menuOpen = false; renderApp() })
window.addEventListener('online', () => { state.online = true; renderApp(); toast('Back online', 'Cloud saves are enabled again.') })
window.addEventListener('offline', () => { state.online = false; renderApp(); toast('You are offline', 'The current data remains readable, but saving is disabled.', 'error') })

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))

;(async function init() {
  await loadConfig()
  try { state.session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { state.session = null }
  await loadAll()
  if (!state.session) location.hash = '#/login'
  else if (!location.hash || location.hash === '#/login') location.hash = '#/dashboard'
  renderApp()
})()
