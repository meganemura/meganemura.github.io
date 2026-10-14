import { roundCents } from "./rounding.ts";

export const invoiceTotal = (cents: number[]): number => roundCents(cents.reduce((a, b) => a + b, 0));
