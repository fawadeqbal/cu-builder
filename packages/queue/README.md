# @cvb/queue

Background jobs behind a port.

- `JobProducer` / `JOB_PRODUCER`: what services depend on to enqueue work.
- `BullMqJobProducer`: the BullMQ adapter (validates payloads against `@cvb/contracts`, applies `DEFAULT_JOB_OPTIONS`).
- `InMemoryJobProducer`: test double. `parseJob()`: validation used by producers and consumers.
- `@cvb/queue/nest`: `QueueModule.forRootAsync({ useFactory: () => ({ redisUrl }) })` registers every queue and provides `JOB_PRODUCER`.
