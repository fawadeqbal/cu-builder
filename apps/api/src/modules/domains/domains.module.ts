import { Module } from "@nestjs/common";
import { DNS_RESOLVER, NodeDnsResolver } from "./dns-resolver.js";
import { DomainsController } from "./domains.controller.js";
import { DomainsService } from "./domains.service.js";

@Module({
  controllers: [DomainsController],
  providers: [DomainsService, { provide: DNS_RESOLVER, useClass: NodeDnsResolver }],
  exports: [DomainsService],
})
export class DomainsModule {}
