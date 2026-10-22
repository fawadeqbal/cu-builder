import { IMPORT_MAX_BYTES, IMPORT_ZIP_MAX_BYTES, LINKEDIN_EXPORT_MIME, QUEUES, type ImportMimeType, type ResumeImportDto } from "@cvb/contracts";
import { isLinkedInExport } from "@cvb/domain";
import { DOCUMENT_EXTENSIONS, sniff as sniffDocument } from "@cvb/extract";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { NotFoundError, ValidationError } from "@cvb/shared";
import { FILE_STORAGE, type FileStorage } from "@cvb/storage";
import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { ResumesService } from "../resumes/resumes.service.js";
import { IMPORTS_REPOSITORY, type ImportRecord, type ImportsRepository } from "./imports.repository.js";
import { slimLinkedInExport, zipEntries } from "./zip.js";

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

// Document types are sniffed by @cvb/extract (shared with the worker and the free ATS check);
// LinkedIn data exports are recognised here, since only imports accept them.
const EXT: Record<MimeType, string> = { ...DOCUMENT_EXTENSIONS, [LINKEDIN_EXPORT_MIME]: "zip" };

const isZip = (b: Buffer) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

/**
 * Works out the file type from its first bytes (and, for text, its name), never just from the
 * browser's claim. Returns a message for files we can recognise but not read.
 */
export function sniff(buffer: Buffer, name: string): MimeType | { error: string } {
  if (isZip(buffer) && !buffer.subarray(0, 200).toString("latin1").includes("application/vnd.oasis.opendocument.text")) {
    const names = zipEntries(buffer);
    if (names && isLinkedInExport(names)) return LINKEDIN_EXPORT_MIME;
    if (names?.length && !names.some((n) => n === "[Content_Types].xml" || n.startsWith("word/"))) {
      return { error: "This ZIP file isn't a LinkedIn data export. Upload the ZIP LinkedIn sent you as it is, or your CV as a PDF or Word file." };
    }
  }
  const type = sniffDocument(buffer, name);
  if (typeof type !== "string" && type.error.startsWith("Only PDF")) {
    return { error: "Only PDF, Word, OpenDocument, RTF, text, HTML and JSON files, or a LinkedIn data export, can be imported" };
  }
  return type;
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
    if (file.size > IMPORT_ZIP_MAX_BYTES) throw new ValidationError("That file is larger than 25 MB");
    const mimeType = sniff(file.buffer, file.originalname);
    if (typeof mimeType !== "string") throw new ValidationError(mimeType.error);
    if (mimeType !== LINKEDIN_EXPORT_MIME && file.size > IMPORT_MAX_BYTES) throw new ValidationError("That file is larger than 5 MB");
    await this.resumes.assertCanAddResume(user);
    const body = mimeType === LINKEDIN_EXPORT_MIME ? this.slim(file.buffer) : file.buffer;

    const ext = EXT[mimeType];
    const fileKey = `imports/${user.id}/${randomUUID()}.${ext}`;
    await this.storage.put(fileKey, body, mimeType);
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

  /** A LinkedIn export is stored with only the files a CV needs (no messages or connections). */
  private slim(buffer: Buffer): Buffer {
    try {
      return slimLinkedInExport(buffer);
    } catch {
      throw new ValidationError("This ZIP file couldn't be opened. Download it from LinkedIn again and upload it as it is.");
    }
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
