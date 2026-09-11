import { rows } from "../store/table.js";

export const total = (factor: number): number => rows.reduce((sum, row) => sum + row * factor, 0);
