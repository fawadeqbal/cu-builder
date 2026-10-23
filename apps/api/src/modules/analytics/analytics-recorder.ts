import type { ServerEventName } from "@cvb/contracts";

export type ServerEventProps = Record<string, string | number | boolean>;

/**
 * Port for events only the server can know reliably (payments, renewals, cancellations).
 * Other features inject it by token; recording never throws (analytics must not break billing).
 */
export interface AnalyticsRecorder {
  record(name: ServerEventName, input: { userId: string | null; props?: ServerEventProps; currency?: string | null; at?: Date }): Promise<void>;
}

export const ANALYTICS_RECORDER = Symbol.for("cvb.api.AnalyticsRecorder");

/** A recorder that drops everything, for tests of other features. */
export class NullAnalyticsRecorder implements AnalyticsRecorder {
  readonly recorded: { name: ServerEventName; userId: string | null; props?: ServerEventProps }[] = [];
  async record(name: ServerEventName, input: { userId: string | null; props?: ServerEventProps }): Promise<void> {
    this.recorded.push({ name, userId: input.userId, props: input.props });
  }
}
