import { invoiceTotal } from "../billing/index.ts";

export const label = (cents: number[]): string => `${invoiceTotal(cents)} cents`;
