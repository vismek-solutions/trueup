import { accountName } from "../account/page.ts";
import { money } from "../shared/money.ts";

export const checkout = (): string => `${accountName} ${money}`;
