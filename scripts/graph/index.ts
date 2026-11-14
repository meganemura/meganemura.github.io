// Pure geometry for the dogfood globe. No DOM, no I/O, no clock.
// The tools sit on a unit sphere: a tool and the tools it uses pull together, every two tools
// push apart, and each registry drifts toward a pole of its own, so the npm tools and the gems
// fill two sides of one globe. The page turns the globe; this module only places the tools and
// projects a turned point, so the server-drawn picture and the turning one use the same math.
// A -> B and B -> A merge into one two-way edge, which keeps mutual use visible.

export interface GraphEdge {
  from: string;
  to: string;
}

export interface GlobeInput {
  id: string;
  group: string;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface GlobeNode extends Vec3 {
  id: string;
  group: string;
  // How many tools here use this one; the page draws a more used tool larger.
  usedBy: number;
}

export interface GlobeEdge extends GraphEdge {
  mutual: boolean;
}

export interface Globe {
  nodes: GlobeNode[];
  edges: GlobeEdge[];
}

const STEPS = 400;
const PUSH = 0.04;
const PULL = 0.015;
const DRIFT = 0.008;

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const length = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const unit = (a: Vec3): Vec3 => {
  const l = length(a);
  return l === 0 ? { x: 0, y: 0, z: 1 } : { x: a.x / l, y: a.y / l, z: a.z / l };
};

export function layoutGlobe(inputs: readonly GlobeInput[], edges: readonly GraphEdge[]): Globe {
  const known = new Set(inputs.map((input) => input.id));
  if (known.size !== inputs.length) throw new Error("duplicate node id");
  for (const edge of edges) {
    if (!known.has(edge.from) || !known.has(edge.to)) throw new Error(`edge ${edge.from} -> ${edge.to} names an unknown node`);
    if (edge.from === edge.to) throw new Error(`edge ${edge.from} -> ${edge.to} is a self loop`);
  }

  // Sorting first makes the result independent of the order the caller listed the tools in.
  const ordered = [...inputs].sort((a, b) => (a.group + "\u0000" + a.id < b.group + "\u0000" + b.id ? -1 : 1));
  const index = new Map(ordered.map((input, i) => [input.id, i]));
  const groups = [...new Set(ordered.map((input) => input.group))];
  // Each registry gets a pole on the equator, evenly spaced; one registry gets none.
  const poles = groups.map((_, g): Vec3 => ({ x: Math.cos((2 * Math.PI * g) / groups.length), y: 0, z: Math.sin((2 * Math.PI * g) / groups.length) }));
  const pole = ordered.map((input) => (groups.length > 1 ? poles[groups.indexOf(input.group)] : undefined));
  const links = [...new Set(edges.map((edge) => [edge.from, edge.to].sort().join("\u0000")))].map((key) => key.split("\u0000").map((id) => index.get(id) as number));

  // Start on a Fibonacci spiral, which spreads any number of points evenly.
  const n = ordered.length;
  let points: Vec3[] = ordered.map((_, i) => {
    const y = n === 1 ? 0 : 1 - (2 * i) / (n - 1);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const turn = Math.PI * (3 - Math.sqrt(5)) * i;
    return { x: r * Math.cos(turn), y, z: r * Math.sin(turn) };
  });
  for (let step = 0; step < STEPS; step += 1) {
    const force = points.map((): Vec3 => ({ x: 0, y: 0, z: 0 }));
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const d = sub(points[i] as Vec3, points[j] as Vec3);
        const scale = PUSH / (d.x * d.x + d.y * d.y + d.z * d.z + 0.01);
        const fi = force[i] as Vec3;
        const fj = force[j] as Vec3;
        fi.x += d.x * scale; fi.y += d.y * scale; fi.z += d.z * scale;
        fj.x -= d.x * scale; fj.y -= d.y * scale; fj.z -= d.z * scale;
      }
    }
    for (const [i, j] of links as [number, number][]) {
      const d = sub(points[j] as Vec3, points[i] as Vec3);
      const fi = force[i] as Vec3;
      const fj = force[j] as Vec3;
      fi.x += d.x * PULL; fi.y += d.y * PULL; fi.z += d.z * PULL;
      fj.x -= d.x * PULL; fj.y -= d.y * PULL; fj.z -= d.z * PULL;
    }
    points = points.map((p, i) => {
      const f = force[i] as Vec3;
      const toward = pole[i];
      const drift = toward === undefined ? { x: 0, y: 0, z: 0 } : { x: toward.x * DRIFT, y: toward.y * DRIFT, z: toward.z * DRIFT };
      return unit({ x: p.x + f.x + drift.x, y: p.y + f.y + drift.y, z: p.z + f.z + drift.z });
    });
  }

  const usedBy = new Map<string, Set<string>>();
  for (const edge of edges) usedBy.set(edge.to, (usedBy.get(edge.to) ?? new Set()).add(edge.from));
  const nodes = ordered.map((input, i) => ({ id: input.id, group: input.group, ...(points[i] as Vec3), usedBy: usedBy.get(input.id)?.size ?? 0 }));

  const directed = new Set(edges.map((edge) => `${edge.from}\u0000${edge.to}`));
  const seen = new Set<string>();
  const merged: GlobeEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.from}\u0000${edge.to}`;
    const reverse = `${edge.to}\u0000${edge.from}`;
    if (seen.has(key) || seen.has(reverse)) continue;
    seen.add(key);
    merged.push({ from: edge.from, to: edge.to, mutual: directed.has(reverse) });
  }
  return { nodes, edges: merged };
}

// Turns a point by `yaw` around the vertical axis, then by `pitch` around the horizontal one.
export function turn(p: Vec3, yaw: number, pitch: number): Vec3 {
  const x = p.x * Math.cos(yaw) + p.z * Math.sin(yaw);
  const z1 = -p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
  const y = p.y * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z = p.y * Math.sin(pitch) + z1 * Math.cos(pitch);
  return { x, y, z };
}

// The points of the shorter great-circle arc from a to b, both ends included, so an edge bends
// around the globe instead of cutting through it.
export function arc(a: Vec3, b: Vec3, segments: number): Vec3[] {
  const ua = unit(a);
  const ub = unit(b);
  const dot = Math.min(1, Math.max(-1, ua.x * ub.x + ua.y * ub.y + ua.z * ub.z));
  const angle = Math.acos(dot);
  const points: Vec3[] = [];
  for (let k = 0; k <= segments; k += 1) {
    const t = k / segments;
    if (angle < 1e-6) {
      points.push(ua);
      continue;
    }
    const wa = Math.sin((1 - t) * angle) / Math.sin(angle);
    const wb = Math.sin(t * angle) / Math.sin(angle);
    points.push(unit({ x: ua.x * wa + ub.x * wb, y: ua.y * wa + ub.y * wb, z: ua.z * wa + ub.z * wb }));
  }
  return points;
}

export interface View {
  cx: number;
  cy: number;
  radius: number;
}

export interface DrawnNode {
  id: string;
  group: string;
  x: number;
  y: number;
  r: number;
  // 1 faces the reader, -1 faces away.
  depth: number;
}

export interface DrawnEdge extends GlobeEdge {
  path: string;
  depth: number;
}

export interface Drawing {
  nodes: DrawnNode[];
  edges: DrawnEdge[];
}

const ARC_SEGMENTS = 18;
const round = (n: number) => Math.round(n * 100) / 100;

// Projects the turned globe onto the page, nodes back to front so a near tool covers a far one.
// An edge stops one segment short of the tool it points at, so its arrowhead stays visible.
export function drawGlobe(globe: Globe, yaw: number, pitch: number, view: View): Drawing {
  const turned = new Map(globe.nodes.map((node) => [node.id, turn(node, yaw, pitch)]));
  const nodes = globe.nodes
    .map((node) => {
      const p = turned.get(node.id) as Vec3;
      return { id: node.id, group: node.group, x: round(view.cx + p.x * view.radius), y: round(view.cy - p.y * view.radius), r: round(6 + 2.5 * Math.sqrt(node.usedBy)), depth: round(p.z) };
    })
    .sort((a, b) => a.depth - b.depth || (a.id < b.id ? -1 : 1));
  const edges = globe.edges.map((edge) => {
    const points = arc(turned.get(edge.from) as Vec3, turned.get(edge.to) as Vec3, ARC_SEGMENTS);
    const kept = points.slice(edge.mutual ? 1 : 0, ARC_SEGMENTS);
    const path = kept.map((p, k) => `${k === 0 ? "M" : "L"}${round(view.cx + p.x * view.radius)} ${round(view.cy - p.y * view.radius)}`).join("");
    const depth = round(points.reduce((sum, p) => sum + p.z, 0) / points.length);
    return { ...edge, path, depth };
  });
  return { nodes, edges };
}
