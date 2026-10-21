import { describe, expect, it } from "vitest";
import { InMemoryJobProducer, parseJob } from "./producer";

describe("job contracts", () => {
  it("records valid jobs", async () => {
    const producer = new InMemoryJobProducer();
    await producer.enqueue("email", "send", { template: "welcome", to: "sara@example.com", name: "Sara" });
    expect(producer.jobs).toHaveLength(1);
  });

  it("rejects invalid payloads", () => {
    expect(() => parseJob("email", "send", { template: "welcome", to: "x" })).toThrow();
  });
});
