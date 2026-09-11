import { store } from "../_state/store.js";
import { kit } from "../_ui/kit.js";

export const mount = (): string => store + kit;
