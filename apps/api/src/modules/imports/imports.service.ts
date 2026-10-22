import { IMPORT_MAX_BYTES, IMPORT_MIME_TYPES, QUEUES, type ResumeImportDto } from "@cvb/contracts";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { NotFoundError, ValidationError } from "@cvb/shared";
import { FILE_STORAGE, type FileStorage } from "@cvb/storage";
import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { ResumesService } from "../resumes/resumes.service.js";
import { IMPORTS_REPOSITORY, type ImportRecord, type ImportsRepository } from "./imports.repository.js";

type MimeType = (typeof IMPORT_MIME_TYPES)[number];

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

/** Checks the file's first bytes, not just the name or the browser's claim. */
function sniff(buffer: Buffer): MimeType | null {
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
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
    if (!file) throw new ValidationError("Choose a PDF or Word file to import");
    if (file.size > IMPORT_MAX_BYTES) throw new ValidationError("That file is larger than 5 MB");
    const mimeType = sniff(file.buffer);
    if (!mimeType) throw new ValidationError("Only PDF and Word (.docx) files can be imported");
    await this.resumes.assertCanAddResume(user);

    const ext = mimeType === "application/pdf" ? "pdf" : "docx";
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
