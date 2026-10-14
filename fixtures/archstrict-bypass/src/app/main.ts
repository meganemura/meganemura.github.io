import { roundCents } from "../billing/rounding.ts";

export const label = (cents: number): string => `${roundCents(cents)} cents`;
