import { CANDIDATE_BATCH_MAX, IMPORT_MAX_BYTES, QUEUES, type CandidateDto, type CandidateUploadResultDto, type UpdateCandidateDto } from "@cvb/contracts";
import { lowConfidenceFields, normalizeCV } from "@cvb/domain";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { NotFoundError, ValidationError } from "@cvb/shared";
import { FILE_STORAGE, type FileStorage } from "@cvb/storage";
import { isTemplateId } from "@cvb/templates/catalog";
import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { OrgsService } from "../orgs/orgs.service.js";
import { CANDIDATES_STORE, type CandidateRecord, type CandidatesStore } from "./candidates.store.js";

export type UploadedFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Checks the file's first bytes, not the name or the browser's claim. */
function sniff(buffer: Buffer): typeof PDF | typeof DOCX | null {
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return PDF;
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) return DOCX;
  return null;
}

export const toCandidateDto = (c: CandidateRecord): CandidateDto => ({
  id: c.id,
  batchId: c.batchId,
  name: c.name,
  status: c.status,
  fileName: c.fileName,
  data: c.data,
  lowConfidence: c.lowConfidence,
  hideContacts: c.hideContacts,
  templateId: c.templateId,
  error: c.error,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

/**
 * Agencies: upload candidate CVs in bulk, let the worker parse each one, review the fields it
 * was unsure about, and export them in the agency's template (contacts hidden per client).
 */
@Injectable()
export class CandidatesService {
  constructor(
    @Inject(CANDIDATES_STORE) private readonly store: CandidatesStore,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
    private readonly orgs: OrgsService,
  ) {}

  async upload(user: AuthUser, orgId: string, files: UploadedFile[]): Promise<CandidateUploadResultDto> {
    const { org } = await this.orgs.access(user, orgId, "candidates.manage");
    if (!files.length) throw new ValidationError("Choose PDF or Word files to upload");
    if (files.length > CANDIDATE_BATCH_MAX) throw new ValidationError(`Upload at most ${CANDIDATE_BATCH_MAX} files at a time`);
    const batchId = randomUUID();
    const accepted: CandidateDto[] = [];
    const rejected: { fileName: string; reason: string }[] = [];
    for (const file of files) {
      const fileName = (file.originalname || "cv").slice(0, 240);
      if (file.size > IMPORT_MAX_BYTES) {
        rejected.push({ fileName, reason: "Larger than 5 MB" });
        continue;
      }
      const mimeType = sniff(file.buffer);
      if (!mimeType) {
        rejected.push({ fileName, reason: "Not a PDF or Word (.docx) file" });
        continue;
      }
      const fileKey = `candidates/${orgId}/${randomUUID()}.${mimeType === PDF ? "pdf" : "docx"}`;
      await this.storage.put(fileKey, file.buffer, mimeType);
      const c = await this.store.create({ orgId, createdById: user.id, batchId, fileKey, fileName, mimeType, templateId: org.defaultTemplateId });
      try {
        await this.jobs.enqueue(QUEUES.candidateImport, "parse", { candidateId: c.id, orgId, fileKey, fileName, mimeType }, { jobId: `candidate-${c.id}` });
        accepted.push(toCandidateDto(c));
      } catch {
        await this.store.update(c.id, { status: "failed", error: "Could not start reading this file" });
        rejected.push({ fileName, reason: "Could not start reading this file" });
      }
    }
    return { batchId, accepted, rejected };
  }

  async list(user: AuthUser, orgId: string, batchId?: string): Promise<CandidateDto[]> {
    await this.orgs.access(user, orgId, "candidates.view");
    return (await this.store.list(orgId, batchId)).map(toCandidateDto);
  }

  async get(user: AuthUser, orgId: string, id: string): Promise<CandidateDto> {
    await this.orgs.access(user, orgId, "candidates.view");
    return toCandidateDto(await this.owned(orgId, id));
  }

  async update(user: AuthUser, orgId: string, id: string, dto: UpdateCandidateDto): Promise<CandidateDto> {
    await this.orgs.access(user, orgId, "candidates.manage");
    const c = await this.owned(orgId, id);
    if (dto.templateId && !isTemplateId(dto.templateId)) throw new ValidationError("Unknown template");
    const data = dto.data ? normalizeCV(dto.data) : undefined;
    const lowConfidence = dto.clearFlags ? [] : data ? lowConfidenceFields(data).filter((f) => c.lowConfidence.some((o) => o.path === f.path)) : undefined;
    return toCandidateDto(
      await this.store.update(id, {
        ...(data ? { data, name: data.personal.name || c.name } : {}),
        ...(lowConfidence ? { lowConfidence } : {}),
        ...(dto.hideContacts !== undefined ? { hideContacts: dto.hideContacts } : {}),
        ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
      }),
    );
  }

  async remove(user: AuthUser, orgId: string, id: string): Promise<void> {
    await this.orgs.access(user, orgId, "candidates.manage");
    const c = await this.owned(orgId, id);
    if (c.fileKey) await this.storage.delete(c.fileKey).catch(() => undefined);
    await this.store.delete(id);
  }

  private async owned(orgId: string, id: string): Promise<CandidateRecord> {
    const c = await this.store.find(id, orgId);
    if (!c) throw new NotFoundError("Candidate", id);
    return c;
  }
}
