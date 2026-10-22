import { resolve4, resolveCname } from "node:dns/promises";

/** DNS lookups behind a port, so domain checks are testable without the network. */
export interface DnsResolver {
  cnames(host: string): Promise<string[]>;
  ipv4(host: string): Promise<string[]>;
}

export const DNS_RESOLVER = Symbol.for("cvb.api.DnsResolver");

/** Missing records and lookup errors both mean "not pointing at us". */
export class NodeDnsResolver implements DnsResolver {
  cnames(host: string) {
    return resolveCname(host).catch(() => [] as string[]);
  }

  ipv4(host: string) {
    return resolve4(host).catch(() => [] as string[]);
  }
}
