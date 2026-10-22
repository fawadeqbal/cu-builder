import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/index.ts", "src/nest.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  // Watch mode rebuilds in place: cleaning would delete files the running apps are reading.
  clean: !options.watch,
  target: "es2023",
  external: [/^@nestjs\//, "bullmq", "ioredis", "reflect-metadata", "rxjs"],
}));
