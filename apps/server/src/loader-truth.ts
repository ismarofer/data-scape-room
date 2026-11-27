// Correct loading options per delivered file (the "truth" behind R1A). Server and scripts only: never imported by the client.
// Must match FORMATS in data/03_inject.py: each sender exports its own way; only H3 writes dates as day/month/year.
import type { FileOpts } from "@codigo-alta/shared";

export const LOADER_TRUTH: Record<string, FileOpts> = {
  "patients.csv": { delimiter: ",", encoding: "utf-8", dateFormat: "none" },
  "organizations.csv": { delimiter: "|", encoding: "utf-8", dateFormat: "none" },
  "conditions.csv": { delimiter: "\t", encoding: "latin-1", dateFormat: "none" },
  "encounters_H1.csv": { delimiter: ",", encoding: "utf-8", dateFormat: "iso" },
  "encounters_H2.csv": { delimiter: ",", encoding: "latin-1", dateFormat: "iso" },
  "encounters_H2_reenvio.csv": { delimiter: ",", encoding: "utf-8", dateFormat: "iso" },
  "encounters_H3.csv": { delimiter: ";", encoding: "latin-1", dateFormat: "dmy_hm" },
  "encounters_H4.csv": { delimiter: "\t", encoding: "utf-8", dateFormat: "iso" },
};
