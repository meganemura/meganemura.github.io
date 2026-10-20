// Pure geometry for the dogfood graph. No DOM, no I/O.
// The most used tool sits in the center and the rest on a ring around it, so its many
// incoming edges become short spokes instead of chords that cross the whole circle.
// A caller can name the center tools instead; two or more sit on a small circle inside the
// ring, and each ring tool moves toward the center tools it is joined to, so the spokes stay
// short and cross less.
// A -> B and B -> A merge into one two-way edge, which keeps mutual use visible.

export interface GraphEdge {
  from: string;
  to: string;
}

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  r: number;
  labelX: number;
  labelY: number;
  anchor: "start" | "middle" | "end";
}

export interface PositionedEdge extends GraphEdge {
  path: string;
  mutual: boolean;
}

export interface GraphLayout {
  width: number;
  height: number;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
}

const NODE_RADIUS = 9;
const MIN_GAP = 2 * NODE_RADIUS + 44;
const BASE_RING = 170;
const LABEL_ROOM = 200;
const BEND = 0.18;

const round = (n: number) => Math.round(n * 100) / 100;

export function layoutGraph(nodeIds: readonly string[], edges: readonly GraphEdge[], center?: readonly string[]): GraphLayout {
  const known = new Set(nodeIds);
  if (known.size !== nodeIds.length) throw new Error("duplicate node id");
  for (const edge of edges) {
    if (!known.has(edge.from) || !known.has(edge.to)) throw new Error(`edge ${edge.from} -> ${edge.to} names an unknown node`);
    if (edge.from === edge.to) throw new Error(`edge ${edge.from} -> ${edge.to} is a self loop`);
  }
  for (const id of center ?? []) if (!known.has(id)) throw new Error(`center ${id} names an unknown node`);
  if (center !== undefined && new Set(center).size !== center.length) throw new Error("duplicate center id");

  const inDegree = new Map(nodeIds.map((id) => [id, 0]));
  for (const edge of edges) inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  const ordered = [...nodeIds].sort((a, b) => (inDegree.get(b) ?? 0) - (inDegree.get(a) ?? 0) || (a < b ? -1 : a > b ? 1 : 0));

  const hubs = center ?? (ordered.length >= 3 && (inDegree.get(ordered[0] as string) ?? 0) > 0 ? [ordered[0] as string] : []);
  const isHub = new Set(hubs);
  const rest = ordered.filter((id) => !isHub.has(id));
  const count = rest.length;
  const ring = count < 2 ? 0 : Math.max(BASE_RING, MIN_GAP / (2 * Math.sin(Math.PI / count)));
  const inner = hubs.length < 2 ? 0 : Math.max(MIN_GAP / (2 * Math.sin(Math.PI / hubs.length)), ring * (hubs.length === 2 ? 0.3 : 0.4));
  const half = ring + NODE_RADIUS + LABEL_ROOM;
  const width = round(2 * half);
  const height = round(2 * (ring + NODE_RADIUS + 40));
  const cx = width / 2;
  const cy = height / 2;

  // Two center tools sit left and right; three or more start at the top and go clockwise.
  const hubAngle = (i: number) => (hubs.length === 2 ? Math.PI : -Math.PI / 2) + (2 * Math.PI * i) / hubs.length;
  // Each ring tool points toward the center tools it is joined to: the sum of the directions
  // to them. The ring keeps the tools in the order of those directions, turned so that each
  // sits as close to its own direction as the even spacing allows. A tool joined to none, or
  // pulled evenly from every side, has no direction and fills the widest gap between the rest.
  const pull = new Map<string, { x: number; y: number }>(rest.map((id) => [id, { x: 0, y: 0 }]));
  if (hubs.length >= 2) {
    for (const edge of edges) {
      const [ringId, hubId] = isHub.has(edge.to) ? [edge.from, edge.to] : [edge.to, edge.from];
      const vector = pull.get(ringId);
      const i = hubs.indexOf(hubId);
      if (vector === undefined || i < 0) continue;
      vector.x += Math.cos(hubAngle(i));
      vector.y += Math.sin(hubAngle(i));
    }
  }
  const towards = new Map<string, number>();
  for (const [id, vector] of pull) if (Math.hypot(vector.x, vector.y) > 0.3) towards.set(id, Math.atan2(vector.y, vector.x));
  const aimed = rest.filter((id) => towards.has(id)).sort((a, b) => (towards.get(a) ?? 0) - (towards.get(b) ?? 0));
  const loose = rest.filter((id) => !towards.has(id));
  let after = aimed.length - 1;
  let widest = -1;
  aimed.forEach((id, i) => {
    const next = aimed[(i + 1) % aimed.length] as string;
    const gap = ((towards.get(next) ?? 0) - (towards.get(id) ?? 0) + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI;
    if (gap > widest) [widest, after] = [gap, i];
  });
  const ringIds = hubs.length >= 2 ? [...aimed.slice(after + 1), ...aimed.slice(0, after + 1), ...loose] : rest;
  let turnX = 0;
  let turnY = 0;
  ringIds.forEach((id, i) => {
    const want = towards.get(id);
    if (want === undefined) return;
    turnX += Math.cos(want - (2 * Math.PI * i) / count);
    turnY += Math.sin(want - (2 * Math.PI * i) / count);
  });
  const start = hubs.length >= 2 && aimed.length > 0 ? Math.atan2(turnY, turnX) : -Math.PI / 2;

  const nodes: PositionedNode[] = [];
  hubs.forEach((id, i) => {
    const r = NODE_RADIUS * 1.6;
    const x = cx + inner * Math.cos(hubAngle(i));
    const y = cy + inner * Math.sin(hubAngle(i));
    nodes.push({ id, x: round(x), y: round(y), r, labelX: round(x), labelY: round(y + r + 18), anchor: "middle" });
  });
  ringIds.forEach((id, i) => {
    const angle = start + (2 * Math.PI * i) / count;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const side = Math.abs(cos) < 0.2 ? 0 : Math.sign(cos);
    const reach = NODE_RADIUS + 8;
    nodes.push({
      id,
      x: round(cx + ring * cos),
      y: round(cy + ring * sin),
      r: NODE_RADIUS,
      labelX: round(cx + ring * cos + side * reach),
      labelY: round(cy + ring * sin + (side === 0 ? Math.sign(sin) * (reach + 6) : 5)),
      anchor: side === 0 ? "middle" : side > 0 ? "start" : "end",
    });
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const directed = new Set(edges.map((edge) => `${edge.from}\u0000${edge.to}`));
  const paths: PositionedEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.from}\u0000${edge.to}`;
    const reverse = `${edge.to}\u0000${edge.from}`;
    if (seen.has(key) || seen.has(reverse)) continue;
    seen.add(key);
    const mutual = directed.has(reverse);
    const a = byId.get(edge.from) as PositionedNode;
    const b = byId.get(edge.to) as PositionedNode;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    const ux = dx / length;
    const uy = dy / length;
    const start = { x: a.x + ux * (a.r + (mutual ? 5 : 2)), y: a.y + uy * (a.r + (mutual ? 5 : 2)) };
    const end = { x: b.x - ux * (b.r + 5), y: b.y - uy * (b.r + 5) };
    const spoke = isHub.has(edge.from) || isHub.has(edge.to);
    const bend = spoke ? 0 : BEND;
    const control = { x: (a.x + b.x) / 2 - uy * length * bend, y: (a.y + b.y) / 2 + ux * length * bend };
    paths.push({ ...edge, mutual, path: `M${round(start.x)} ${round(start.y)} Q${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}` });
  }

  return { width, height, nodes, edges: paths };
}
