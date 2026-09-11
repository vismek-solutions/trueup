import { mount } from "../_root/mount.js";
import { store } from "../_state/store.js";
import { kit } from "../_ui/kit.js";

export const page = (): string => mount() + store + kit;
