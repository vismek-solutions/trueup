import { renderLayout } from "../../../components/layout.ts";
import { renderPairHead } from "../../../components/pair.ts";
import { renderUserCard } from "../../../components/user-card.ts";

export const users = (names: readonly string[]): string =>
  renderLayout(renderPairHead("users") + names.map(renderUserCard).join(""));
