import type { Team, Worker } from './types'

/*
 * Deterministic organization layout. No force simulation: the same data always yields the same picture.
 *   - the executive sits at the top, with reporting lines to the head of each team
 *   - each team is a region; each person who owns AI workers is a pod
 *   - a pod is the person on top and their accountable AI workers as dots beneath
 * A pod is therefore exactly an ownership relationship, readable without any setup.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface NodePos {
  id: string
  kind: 'human' | 'ai'
  teamId: string
  x: number
  y: number
  r: number
}

export interface MapLayout {
  width: number
  height: number
  execId: string
  regions: Map<string, Rect>
  pods: Map<string, Rect>
  nodes: Map<string, NodePos>
  /** Points that are not people: where the executive's line enters a team whose head is the executive. */
  hubs: Map<string, { x: number; y: number }>
  /** Reporting lines. 'top' lines run from the executive to a team; 'team' lines from a team head to a person. */
  edges: Array<{ from: string; to: string; level: 'top' | 'team'; /** For top lines: the elbow route, kept out of other teams' contents. */ path?: Array<[number, number]> }>
}

const COLS = 4
const REGION_W = 280
const REGION_H = 300
const GAP = 20
const ROW_GAP = 40
const MARGIN = 10
const TOP = 96
const HEADER = 30
const POD_COLS = 3
const AI_COLS = 5
const AI_PITCH = 12.5
const R_EXEC = 9
const R_LEAD = 8
const R_HUMAN = 6.5
const R_AI = 4.2

export function layoutMap(workers: Worker[], teams: Team[]): MapLayout {
  const width = COLS * REGION_W + (COLS - 1) * GAP + 2 * MARGIN
  const rows = Math.ceil(teams.length / COLS)
  const height = TOP + rows * REGION_H + (rows - 1) * ROW_GAP + MARGIN

  const exec = workers.find((w) => w.kind === 'human' && w.ownerId === null)!
  const nodes = new Map<string, NodePos>()
  const regions = new Map<string, Rect>()
  const pods = new Map<string, Rect>()
  const edges: MapLayout['edges'] = []
  const hubs: MapLayout['hubs'] = new Map()

  nodes.set(exec.id, { id: exec.id, kind: 'human', teamId: exec.teamId, x: width / 2, y: 34, r: R_EXEC })
  // Elbow routes run down the left margin and through the gap between rows, never across another team's people.
  const route = (ex: number, row: number, tx: number, ty: number): Array<[number, number]> => {
    const busTop = TOP - 20
    if (row === 0) return [[ex, 34 + R_EXEC + 2], [ex, busTop], [tx, busTop], [tx, ty]]
    const busRow = TOP + row * (REGION_H + ROW_GAP) - ROW_GAP / 2
    return [[ex, 34 + R_EXEC + 2], [ex, busTop], [4, busTop], [4, busRow], [tx, busRow], [tx, ty]]
  }

  teams.forEach((team, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const rect: Rect = { x: MARGIN + col * (REGION_W + GAP), y: TOP + row * (REGION_H + ROW_GAP), w: REGION_W, h: REGION_H }
    regions.set(team.id, rect)

    const people = workers.filter((w) => w.kind === 'human' && w.teamId === team.id).sort((a, b) => a.id.localeCompare(b.id))
    const lead = people.find((p) => p.ownerId === exec.id || p.ownerId === null)!
    const leadIsExec = lead.id === exec.id
    if (!leadIsExec) {
      nodes.set(lead.id, { id: lead.id, kind: 'human', teamId: team.id, x: rect.x + rect.w / 2, y: rect.y + HEADER + 14, r: R_LEAD })
      edges.push({ from: exec.id, to: lead.id, level: 'top', path: route(width / 2, row, rect.x + rect.w / 2, rect.y + HEADER + 14 - R_LEAD - 2) })
    } else {
      hubs.set(`hub:${team.id}`, { x: rect.x + rect.w / 2, y: rect.y + HEADER + 14 })
      edges.push({ from: exec.id, to: `hub:${team.id}`, level: 'top', path: route(width / 2, row, rect.x + rect.w / 2, rect.y + HEADER + 14 - 4) })
    }

    const owners = people.filter((p) => p.id !== lead.id && p.id !== exec.id)
    const podW = (rect.w - 16) / POD_COLS
    const podTop = rect.y + HEADER + 36
    const podH = (rect.h - HEADER - 36 - 8) / 2
    owners.forEach((owner, j) => {
      const pod: Rect = { x: rect.x + 8 + (j % POD_COLS) * podW, y: podTop + Math.floor(j / POD_COLS) * podH, w: podW, h: podH }
      pods.set(owner.id, pod)
      nodes.set(owner.id, { id: owner.id, kind: 'human', teamId: team.id, x: pod.x + pod.w / 2, y: pod.y + 8, r: R_HUMAN })
      edges.push({ from: leadIsExec ? `hub:${team.id}` : lead.id, to: owner.id, level: 'team' })

      const mine = workers.filter((w) => w.kind === 'ai' && w.ownerId === owner.id).sort((a, b) => a.id.localeCompare(b.id))
      const gridW = (Math.min(mine.length, AI_COLS) - 1) * AI_PITCH
      mine.forEach((w, k) => {
        nodes.set(w.id, {
          id: w.id,
          kind: 'ai',
          teamId: team.id,
          x: pod.x + pod.w / 2 - gridW / 2 + (k % AI_COLS) * AI_PITCH,
          y: pod.y + 36 + Math.floor(k / AI_COLS) * AI_PITCH,
          r: R_AI,
        })
      })
    })
  })

  return { width, height, execId: exec.id, regions, pods, nodes, hubs, edges }
}

/** Bounding box of a set of nodes, padded. Used by the camera to focus a finding or a pod. */
export function boundsOf(layout: MapLayout, ids: string[], pad = 24): Rect | null {
  const pts = ids.map((id) => layout.nodes.get(id)).filter((n): n is NodePos => !!n)
  if (pts.length === 0) return null
  const minX = Math.min(...pts.map((p) => p.x - p.r))
  const maxX = Math.max(...pts.map((p) => p.x + p.r))
  const minY = Math.min(...pts.map((p) => p.y - p.r))
  const maxY = Math.max(...pts.map((p) => p.y + p.r))
  return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad }
}

/** Where a node or a hub sits. */
export function pointOf(layout: MapLayout, id: string): { x: number; y: number } | undefined {
  return layout.nodes.get(id) ?? layout.hubs.get(id)
}