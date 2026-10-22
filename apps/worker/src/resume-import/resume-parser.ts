import type { ResumeImportJob } from "@cvb/contracts";
import { parseResumeText, type ParsedCV } from "@cvb/domain";
import { FILE_STORAGE, type FileStorage } from "@cvb/storage";
import { Inject, Injectable } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

/** Port: turns an uploaded file into a CV document plus review warnings. */
export interface ResumeParser {
  parse(job: ResumeImportJob): Promise<ParsedCV>;
}

export const RESUME_PARSER = Symbol.for("cvb.worker.ResumeParser");

/** Reads the file from storage, extracts text (PDF or DOCX) and applies the domain parser. */
@Injectable()
export class FileResumeParser implements ResumeParser {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  async parse(job: ResumeImportJob): Promise<ParsedCV> {
    const bytes = await this.storage.get(job.fileKey);
    const text = await this.extract(bytes, job.mimeType);
    if (text.replace(/\s/g, "").length < 40) {
      throw new UnrecoverableError("We couldn't read any text in this file. If it's a scan, try a Word or text-based PDF.");
    }
    return parseResumeText(text);
  }

  private async extract(bytes: Uint8Array, mimeType: ResumeImportJob["mimeType"]): Promise<string> {
    try {
      if (mimeType === "application/pdf") {
        const pdf = await getDocumentProxy(bytes);
        const { text } = await extractText(pdf, { mergePages: true });
        return text;
      }
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return value;
    } catch {
      throw new UnrecoverableError("This file couldn't be opened. Check it isn't password-protected or damaged.");
    }
  }
}
