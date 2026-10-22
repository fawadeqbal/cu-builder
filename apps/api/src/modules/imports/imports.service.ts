import { IMPORT_MAX_BYTES, QUEUES, type ImportMimeType, type ResumeImportDto } from "@cvb/contracts";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { NotFoundError, ValidationError } from "@cvb/shared";
import { FILE_STORAGE, type FileStorage } from "@cvb/storage";
import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { ResumesService } from "../resumes/resumes.service.js";
import { IMPORTS_REPOSITORY, type ImportRecord, type ImportsRepository } from "./imports.repository.js";

type MimeType = ImportMimeType;

export type UploadedFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };

const toDto = (r: ImportRecord): ResumeImportDto => ({
  id: r.id,
  status: r.status,
  fileName: r.fileName,
  resumeId: r.resumeId,
  error: r.error,
  warnings: r.warnings,
  createdAt: r.createdAt.toISOString(),
});

const EXT: Record<MimeType, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/rtf": "rtf",
  "text/plain": "txt",
  "text/html": "html",
  "application/json": "json",
};

/** Text that is valid UTF-8 and mostly printable (not a binary file with a .txt name). */
function looksLikeText(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 4096);
  if (head.includes(0)) return false;
  const text = head.toString("utf8");
  const bad = (text.match(/\uFFFD/g) ?? []).length;
  return bad < 3;
}

/**
 * Works out the file type from its first bytes (and, for text, its name), never just from the
 * browser's claim. Returns a message for files we can recognise but not read.
 */
export function sniff(buffer: Buffer, name: string): MimeType | { error: string } {
  const lower = name.toLowerCase();
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    const head = buffer.subarray(0, 200).toString("latin1");
    if (head.includes("application/vnd.oasis.opendocument.text")) return "application/vnd.oasis.opendocument.text";
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
    return { error: "Old Word (.doc) files can't be read. Open it in Word or Google Docs and save it as .docx or PDF." };
  }
  if ((buffer[0] === 0xff && buffer[1] === 0xd8) || buffer.subarray(1, 4).toString("latin1") === "PNG") {
    return { error: "This looks like a photo or scan. Export your CV as a PDF with selectable text, or a Word file." };
  }
  const start = buffer.subarray(0, 64).toString("utf8").replace(/^\uFEFF/, "").trimStart();
  if (start.startsWith("{\\rtf")) return "application/rtf";
  if (!looksLikeText(buffer)) return { error: "Only PDF, Word, OpenDocument, RTF, text, HTML and JSON files can be imported" };
  if (start.startsWith("{") || lower.endsWith(".json")) return "application/json";
  if (/^<(!doctype html|html|head|body|div|p|h1)/i.test(start) || /\.html?$/.test(lower)) return "text/html";
  return "text/plain";
}

@Injectable()
export class ImportsService {
  constructor(
    @Inject(IMPORTS_REPOSITORY) private readonly imports: ImportsRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
    private readonly resumes: ResumesService,
  ) {}

  async start(user: AuthUser, file: UploadedFile | undefined): Promise<ResumeImportDto> {
    if (!file) throw new ValidationError("Choose your CV file to import");
    if (file.size > IMPORT_MAX_BYTES) throw new ValidationError("That file is larger than 5 MB");
    const mimeType = sniff(file.buffer, file.originalname);
    if (typeof mimeType !== "string") throw new ValidationError(mimeType.error);
    await this.resumes.assertCanAddResume(user);

    const ext = EXT[mimeType];
    const fileKey = `imports/${user.id}/${randomUUID()}.${ext}`;
    await this.storage.put(fileKey, file.buffer, mimeType);
    const fileName = file.originalname.slice(0, 240) || `cv.${ext}`;
    const record = await this.imports.create({ userId: user.id, fileKey, fileName, mimeType });

    try {
      await this.jobs.enqueue(
        QUEUES.resumeImport,
        "parse",
        { importId: record.id, userId: user.id, fileKey, fileName, mimeType },
        { jobId: `import-${record.id}` },
      );
    } catch (e) {
      await this.imports.markFailed(record.id, "Could not start the import");
      throw e;
    }
    return toDto(record);
  }

  async get(user: AuthUser, id: string): Promise<ResumeImportDto> {
    const r = await this.imports.findOwned(id, user.id);
    if (!r) throw new NotFoundError("Import", id);
    return toDto(r);
  }

  async recent(user: AuthUser): Promise<ResumeImportDto[]> {
    return (await this.imports.listRecent(user.id, 10)).map(toDto);
  }
}
