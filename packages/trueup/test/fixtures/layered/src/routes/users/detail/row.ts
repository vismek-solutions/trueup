import { renderPairFoot } from "../../../components/pair.ts";
import { renderUserCard } from "../../../components/user-card.ts";

export const row = (name: string): string => `<tr>${renderUserCard(name)}${renderPairFoot(name)}</tr>`;
