import { thing } from "../b/thing.js";
import { chrome } from "../shared/chrome.js";

export const page = (): string => `${thing}${chrome()}`;
