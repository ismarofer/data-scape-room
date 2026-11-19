// Correct loading options per delivered file (the "truth" behind R1A). Server/tests only: never imported by the client.
import { FILE_SPECS, type FileOpts } from "@codigo-alta/shared";
export const TRUTH: Record<string, FileOpts> = Object.fromEntries(
  FILE_SPECS.map((s) => [
    s.name,
    (s.name.includes("H3")
      ? { delimiter: ";", encoding: "latin-1", dateFormat: "dmy_hm" }
      : { delimiter: ",", encoding: "utf-8", dateFormat: s.dateCols.length ? "iso" : "none" }) as FileOpts,
  ]),
);
