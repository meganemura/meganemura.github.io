import * as hegel from "@hegeldev/hegel";
import * as gs from "@hegeldev/hegel/generators";
import { expect, test } from "vitest";
import { arc, drawGlobe, layoutGlobe, turn, type GlobeInput, type GraphEdge, type Vec3 } from "../scripts/graph/index.ts";

const graphGen = gs.composite<{ inputs: GlobeInput[]; edges: GraphEdge[] }>((tc) => {
  const size = tc.draw(gs.integers({ minValue: 0, maxValue: 16 }));
  const inputs = Array.from({ length: size }, (_, i) => ({ id: `n${i}`, group: tc.draw(gs.sampledFrom(["npm", "rubygems"])) }));
  const edges: GraphEdge[] = [];
  if (size >= 2) {
    const picks = tc.draw(
      gs.arrays(gs.tuples(gs.integers({ minValue: 0, maxValue: size - 1 }), gs.integers({ minValue: 0, maxValue: size - 1 })), { maxSize: 30 }),
    );
    for (const [from, to] of picks) if (from !== to) edges.push({ from: `n${from}`, to: `n${to}` });
  }
  return { inputs, edges };
});

const unitPoint = gs.composite<Vec3>((tc) => {
  const angle = (max: number) => tc.draw(gs.floats({ minValue: -max, maxValue: max, allowNan: false, allowInfinity: false }));
  const lon = angle(Math.PI);
  const lat = angle(Math.PI / 2);
  return { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) };
});

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9);

test("every tool sits on the unit sphere", () =>
  hegel.test((tc) => {
    const { inputs, edges } = tc.draw(graphGen);
    for (const node of layoutGlobe(inputs, edges).nodes) close(Math.hypot(node.x, node.y, node.z), 1);
  }));

test("the globe does not depend on the order the tools are listed in", () =>
  hegel.test((tc) => {
    const { inputs, edges } = tc.draw(graphGen);
    expect(layoutGlobe([...inputs].reverse(), edges)).toEqual(layoutGlobe(inputs, edges));
  }));

test("every input edge is drawn by exactly one edge, and the node set is preserved", () =>
  hegel.test((tc) => {
    const { inputs, edges } = tc.draw(graphGen);
    const globe = layoutGlobe(inputs, edges);
    for (const edge of edges) {
      const drawn = globe.edges.filter((e) => (e.from === edge.from && e.to === edge.to) || (e.mutual && e.from === edge.to && e.to === edge.from));
      expect(drawn.length).toBe(1);
    }
    expect(globe.nodes.map((n) => n.id).sort()).toEqual(inputs.map((i) => i.id).sort());
  }));

test("turning keeps a point on the sphere", () =>
  hegel.test((tc) => {
    const p = tc.draw(unitPoint);
    const yaw = tc.draw(gs.floats({ minValue: -10, maxValue: 10, allowNan: false, allowInfinity: false }));
    const pitch = tc.draw(gs.floats({ minValue: -10, maxValue: 10, allowNan: false, allowInfinity: false }));
    const q = turn(p, yaw, pitch);
    close(Math.hypot(q.x, q.y, q.z), 1);
  }));

test("an arc starts and ends at its two tools and stays on the sphere", () =>
  hegel.test((tc) => {
    const a = tc.draw(unitPoint);
    const b = tc.draw(unitPoint);
    const points = arc(a, b, 12);
    expect(points.length).toBe(13);
    for (const p of points) close(Math.hypot(p.x, p.y, p.z), 1);
    const first = points[0] as Vec3;
    close(first.x, a.x);
    close(first.y, a.y);
    close(first.z, a.z);
    const last = points[12] as Vec3;
    if (Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)) > 1e-6) {
      close(last.x, b.x);
      close(last.y, b.y);
      close(last.z, b.z);
    }
  }));

test("a drawing puts the nearest tool last, and every tool inside the view", () =>
  hegel.test((tc) => {
    const { inputs, edges } = tc.draw(graphGen);
    const drawing = drawGlobe(layoutGlobe(inputs, edges), 0.4, -0.3, { cx: 100, cy: 100, radius: 80 });
    for (const [i, node] of drawing.nodes.entries()) {
      if (i > 0) expect(node.depth).toBeGreaterThanOrEqual((drawing.nodes[i - 1] as { depth: number }).depth);
      expect(Math.hypot(node.x - 100, node.y - 100)).toBeLessThanOrEqual(80.01);
    }
  }));

test("use in both directions is one mutual edge, and a used tool counts its users", () => {
  const globe = layoutGlobe(
    [
      { id: "a", group: "npm" },
      { id: "b", group: "npm" },
      { id: "c", group: "npm" },
    ],
    [
      { from: "a", to: "c" },
      { from: "b", to: "c" },
      { from: "c", to: "b" },
    ],
  );
  expect(globe.edges).toEqual([
    { from: "a", to: "c", mutual: false },
    { from: "b", to: "c", mutual: true },
  ]);
  expect(globe.nodes.map((n) => [n.id, n.usedBy])).toEqual([["a", 0], ["b", 1], ["c", 2]]);
});

test("an edge to an unknown node is a loud error", () => {
  expect(() => layoutGlobe([{ id: "a", group: "npm" }], [{ from: "a", to: "z" }])).toThrow("edge a -> z names an unknown node");
  expect(() => layoutGlobe([{ id: "a", group: "npm" }], [{ from: "a", to: "a" }])).toThrow("self loop");
});
