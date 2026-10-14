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

test("the edge count and the node set are preserved", () =>
  hegel.test((tc) => {
    const { ids, edges } = tc.draw(graphGen);
    const layout = layoutGraph(ids, edges);
    expect(layout.edges.length).toBe(edges.length);
    expect(layout.nodes.map((n) => n.id).sort()).toEqual([...ids].sort());
  }));

test("the same input always gives the same layout", () =>
  hegel.test((tc) => {
    const { ids, edges } = tc.draw(graphGen);
    expect(layoutGraph(ids, edges)).toEqual(layoutGraph([...ids], edges.map((e) => ({ ...e }))));
  }));

test("the most used tool takes the top of the circle", () => {
  const layout = layoutGraph(
    ["a", "b", "c"],
    [
      { from: "a", to: "c" },
      { from: "b", to: "c" },
    ],
  );
  expect(layout.nodes[0]).toMatchObject({ id: "c", x: layout.width / 2 });
  expect(layout.nodes[0]?.y).toBeLessThan(layout.height / 2);
});

test("an edge to an unknown node is a loud error", () => {
  expect(() => layoutGraph(["a"], [{ from: "a", to: "z" }])).toThrow("edge a -> z names an unknown node");
  expect(() => layoutGraph(["a"], [{ from: "a", to: "a" }])).toThrow("self loop");
});
