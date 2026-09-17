import { renderButton } from "../../components/button.ts";
import { renderLayout } from "../../components/layout.ts";

export const about = (): string => renderLayout(renderButton("about"));
