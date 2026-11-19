import type { FileSpec } from "./csv";

/** Delivered files (public information: names, keys and date columns; never the expected counts). */
export const FILE_SPECS: FileSpec[] = [
  { name: "patients.csv", key: ["patient_id"], dateCols: [] },
  { name: "organizations.csv", key: ["organization_id"], dateCols: [] },
  { name: "encounters_H1.csv", key: ["encounter_id"], dateCols: ["start_ts", "stop_ts"] },
  { name: "encounters_H2.csv", key: ["encounter_id"], dateCols: ["start_ts", "stop_ts"] },
  { name: "encounters_H2_reenvio.csv", key: ["encounter_id"], dateCols: ["start_ts", "stop_ts"] },
  { name: "encounters_H3.csv", key: ["encounter_id"], dateCols: ["start_ts", "stop_ts"] },
  { name: "encounters_H4.csv", key: ["encounter_id"], dateCols: ["start_ts", "stop_ts"] },
  { name: "conditions.csv", key: ["patient_id", "encounter_id", "code"], dateCols: [] },
];
export const rawTableName = (file: string) => file.replace(/\.csv$/, "").toLowerCase();
