import { run } from "../../../core/src/index.ts";

export const badge = (status: string): string =>
  status === "awaiting_payment" ? `amber ${run()}` : "grey";
