import type { EmailJob } from "@cvb/contracts";
import type { Job } from "bullmq";
import { describe, expect, it } from "vitest";
import type { EmailSender } from "./email-sender.js";
import { EmailProcessor } from "./email.processor.js";

describe("EmailProcessor", () => {
  it("validates the payload and hands it to the sender", async () => {
    const sent: EmailJob[] = [];
    const sender: EmailSender = { send: async (m) => void sent.push(m) };
    const processor = new EmailProcessor(sender);

    await processor.process({ id: "1", data: { template: "welcome", to: "sara@example.com", name: "Sara" } } as Job);
    expect(sent).toHaveLength(1);

    await expect(processor.process({ id: "2", data: { template: "welcome", to: "bad" } } as Job)).rejects.toThrow();
  });
});
