import { getCollection } from "astro:content";
import { heading } from "virtual:site/heading";
import { title } from "./title.ts";

export const page = `${title} ${heading} ${getCollection}`;
