import { IMPORT_MAX_BYTES } from "@cvb/contracts";
import { isLinkedInExportFile } from "@cvb/domain";
import { unzipSync, zipSync } from "fflate";

/** The file names inside a ZIP, without decompressing anything; null if it isn't a readable ZIP. */
export function zipEntries(buffer: Buffer): string[] | null {
  const names: string[] = [];
  try {
    unzipSync(buffer, {
      filter: (f) => {
        names.push(f.name);
        return false;
      },
    });
    return names;
  } catch {
    return null;
  }
}

/**
 * Keeps only the CSV files a CV is built from (profile, positions, education, skills…). A full
 * LinkedIn archive also holds messages and connections, which we never need to store.
 */
export function slimLinkedInExport(buffer: Buffer): Buffer {
  const files = unzipSync(buffer, { filter: (f) => isLinkedInExportFile(f.name) && f.originalSize <= IMPORT_MAX_BYTES });
  return Buffer.from(zipSync(files, { level: 6 }));
}
