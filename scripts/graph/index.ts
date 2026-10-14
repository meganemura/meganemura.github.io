// Pure geometry for the dogfood graph: nodes on a circle, ordered by how many
// tools use them, and one curved path per edge. No DOM, no I/O.
// Edges bend sideways so that A -> B and B -> A never draw on top of each other.

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

export function layoutGraph(nodeIds: readonly string[], edges: readonly GraphEdge[]): GraphLayout {
  const known = new Set(nodeIds);
  if (known.size !== nodeIds.length) throw new Error("duplicate node id");
  for (const edge of edges) {
    if (!known.has(edge.from) || !known.has(edge.to)) throw new Error(`edge ${edge.from} -> ${edge.to} names an unknown node`);
    if (edge.from === edge.to) throw new Error(`edge ${edge.from} -> ${edge.to} is a self loop`);
  }

  const inDegree = new Map(nodeIds.map((id) => [id, 0]));
  for (const edge of edges) inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  const ordered = [...nodeIds].sort((a, b) => (inDegree.get(b) ?? 0) - (inDegree.get(a) ?? 0) || (a < b ? -1 : a > b ? 1 : 0));

  const count = ordered.length;
  const ring = count < 2 ? 0 : Math.max(BASE_RING, MIN_GAP / (2 * Math.sin(Math.PI / count)));
  const half = ring + NODE_RADIUS + LABEL_ROOM;
  const width = round(2 * half);
  const height = round(2 * (ring + NODE_RADIUS + 40));
  const cx = width / 2;
  const cy = height / 2;

  const nodes: PositionedNode[] = ordered.map((id, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const side = Math.abs(cos) < 0.2 ? 0 : Math.sign(cos);
    const reach = NODE_RADIUS + 8;
    return {
      id,
      x: round(cx + ring * cos),
      y: round(cy + ring * sin),
      r: NODE_RADIUS,
      labelX: round(cx + ring * cos + side * reach),
      labelY: round(cy + ring * sin + (side === 0 ? Math.sign(sin) * (reach + 6) : 5)),
      anchor: side === 0 ? "middle" : side > 0 ? "start" : "end",
    };
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const paths: PositionedEdge[] = edges.map((edge) => {
    const a = byId.get(edge.from) as PositionedNode;
    const b = byId.get(edge.to) as PositionedNode;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    const ux = dx / length;
    const uy = dy / length;
    const start = { x: a.x + ux * (a.r + 2), y: a.y + uy * (a.r + 2) };
    const end = { x: b.x - ux * (b.r + 5), y: b.y - uy * (b.r + 5) };
    const control = { x: (a.x + b.x) / 2 - uy * length * BEND, y: (a.y + b.y) / 2 + ux * length * BEND };
    return { ...edge, path: `M${round(start.x)} ${round(start.y)} Q${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}` };
  });

  return { width, height, nodes, edges: paths };
}
