import { adminClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Better Auth on the same origin at /api/auth (proxied to the API). */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [magicLinkClient(), adminClient()],
});
