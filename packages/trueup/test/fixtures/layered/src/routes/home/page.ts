import { renderBadge } from "../../components/badge.ts";
import { renderButton } from "../../components/button.ts";
import { renderLayout } from "../../components/layout.ts";

export const home = (): string => renderLayout(renderButton("home") + renderBadge(1));
