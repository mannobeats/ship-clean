import leftPad from "left-pad";
import slugify from "slugify";
import { a } from "./a.js";

export const value = leftPad(a + slugify("hello"), 4);
