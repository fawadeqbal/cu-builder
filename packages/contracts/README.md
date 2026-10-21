# @cvb/contracts

zod schemas for everything that crosses a boundary: HTTP DTOs (`CreateResumeSchema`, `ResumeSchema`, `ApiErrorSchema`, pagination) and background jobs (`QUEUES`, `JOBS`, payload schemas). The API validates with them, the worker parses jobs with them, the web app types its calls with them. `ResumeDataSchema` is checked at compile time against the domain `CV` type.
