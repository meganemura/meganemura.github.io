import * as hegel from "@hegeldev/hegel";
import * as gs from "@hegeldev/hegel/generators";
import { expect, test } from "vitest";
import { layoutGraph, type GraphEdge } from "../scripts/graph/index.ts";

const graphGen = gs.composite<{ ids: string[]; edges: GraphEdge[] }>((tc) => {
  const size = tc.draw(gs.integers({ minValue: 0, maxValue: 24 }));
  const ids = Array.from({ length: size }, (_, i) => `n${i}`);
  const edges: GraphEdge[] = [];
  if (size >= 2) {
    const picks = tc.draw(
      gs.arrays(
        gs.tuples(gs.integers({ minValue: 0, maxValue: size - 1 }), gs.integers({ minValue: 0, maxValue: size - 1 })),
        { maxSize: 40 },
      ),
    );
    for (const [from, to] of picks) if (from !== to) edges.push({ from: `n${from}`, to: `n${to}` });
  }
  return { ids, edges };
});

test("every node lies inside the viewBox", () =>
  hegel.test((tc) => {
    const { ids, edges } = tc.draw(graphGen);
    const layout = layoutGraph(ids, edges);
    for (const node of layout.nodes) {
      expect(node.x - node.r).toBeGreaterThanOrEqual(0);
      expect(node.y - node.r).toBeGreaterThanOrEqual(0);
      expect(node.x + node.r).toBeLessThanOrEqual(layout.width);
      expect(node.y + node.r).toBeLessThanOrEqual(layout.height);
    }
  }));

test("no two node centers are closer than a node diameter", () =>
  hegel.test((tc) => {
    const { ids, edges } = tc.draw(graphGen);
    const { nodes } = layoutGraph(ids, edges);
    for (const [i, a] of nodes.entries()) {
      for (const b of nodes.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * a.r);
      }
    }
  }));

test("every input edge is drawn by exactly one edge, and the node set is preserved", () =>
  hegel.test((tc) => {
    const { ids, edges } = tc.draw(graphGen);
    const layout = layoutGraph(ids, edges);
    for (const edge of edges) {
      const drawn = layout.edges.filter(
        (e) => (e.from === edge.from && e.to === edge.to) || (e.mutual && e.from === edge.to && e.to === edge.from),
      );
      expect(drawn.length).toBe(1);
    }
    expect(layout.nodes.map((n) => n.id).sort()).toEqual([...ids].sort());
  }));

test("the same input always gives the same layout", () =>
  hegel.test((tc) => {
    const { ids, edges } = tc.draw(graphGen);
    expect(layoutGraph(ids, edges)).toEqual(layoutGraph([...ids], edges.map((e) => ({ ...e }))));
  }));

test("the most used tool takes the center, and use in both directions is one mutual edge", () => {
  const layout = layoutGraph(
    ["a", "b", "c"],
    [
      { from: "a", to: "c" },
      { from: "b", to: "c" },
      { from: "c", to: "b" },
    ],
  );
  expect(layout.nodes[0]).toMatchObject({ id: "c", x: layout.width / 2, y: layout.height / 2 });
  expect(layout.edges.map((e) => [e.from, e.to, e.mutual])).toEqual([
    ["a", "c", false],
    ["b", "c", true],
  ]);
});

test("an edge to an unknown node is a loud error", () => {
  expect(() => layoutGraph(["a"], [{ from: "a", to: "z" }])).toThrow("edge a -> z names an unknown node");
  expect(() => layoutGraph(["a"], [{ from: "a", to: "a" }])).toThrow("self loop");
});
