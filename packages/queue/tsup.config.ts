import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/nest.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2023",
  external: [/^@nestjs\//, "bullmq", "ioredis", "reflect-metadata", "rxjs"],
});
