import { QUEUES, type EmailJob } from "@cvb/contracts";
import type { DbClient } from "@cvb/db";
import type { JobProducer } from "@cvb/queue";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, magicLink } from "better-auth/plugins";
import type { AppConfig } from "../../config/app-config.js";

export type AuthDeps = { db: DbClient; config: AppConfig; jobs: JobProducer };

/**
 * Better Auth, configured for CV Builder. It owns sign-up, sign-in (email + password, magic
 * link, Google, LinkedIn), sessions, email verification, password reset and admin actions,
 * and stores everything in our Postgres tables through Prisma. Emails go through the queue.
 */
export function createBetterAuth({ db, config, jobs }: AuthDeps) {
  const email = (payload: EmailJob) => jobs.enqueue(QUEUES.email, "send", payload).then(() => undefined);

  const socialProviders = {
    ...(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: config.GOOGLE_CLIENT_ID, clientSecret: config.GOOGLE_CLIENT_SECRET } }
      : {}),
    ...(config.LINKEDIN_CLIENT_ID && config.LINKEDIN_CLIENT_SECRET
      ? { linkedin: { clientId: config.LINKEDIN_CLIENT_ID, clientSecret: config.LINKEDIN_CLIENT_SECRET } }
      : {}),
  };

  return betterAuth({
    appName: "CV Builder",
    baseURL: config.APP_URL,
    basePath: "/api/auth",
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [config.APP_URL, ...config.API_CORS_ORIGINS],
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      requireEmailVerification: false,
      sendResetPassword: ({ user, url }) => email({ template: "reset-password", to: user.email, name: user.name, url }),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: ({ user, url }) => email({ template: "verify-email", to: user.email, name: user.name, url }),
    },
    socialProviders,
    // Deleting the user row cascades to sessions, accounts, CVs, versions, links, imports and billing rows.
    user: { deleteUser: { enabled: true } },
    account: { accountLinking: { enabled: true, trustedProviders: ["google", "linkedin"] } },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: { enabled: config.NODE_ENV === "production" },
    plugins: [
      magicLink({ sendMagicLink: ({ email: to, url }) => email({ template: "magic-link", to, url }) }),
      admin({ defaultRole: "user", adminRoles: ["admin"] }),
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: { ...user, role: config.ADMIN_EMAILS.includes(user.email.toLowerCase()) ? "admin" : "user" },
          }),
          after: async (user) => {
            await db.analyticsEvent.create({ data: { name: "signed_up", anonymousId: user.id, userId: user.id } }).catch(() => undefined);
            await jobs.enqueue(
              QUEUES.email,
              "send",
              { template: "welcome", to: user.email, name: user.name },
              { jobId: `welcome-${user.id}` },
            );
          },
        },
      },
    },
  });
}

export type BetterAuth = ReturnType<typeof createBetterAuth>;

/** Injection token for the Better Auth instance. */
export const AUTH = Symbol.for("cvb.api.BetterAuth");

/** Which sign-in methods are configured, for the web app's buttons. */
export const authProviders = (config: AppConfig) => ({
  emailPassword: true,
  magicLink: true,
  google: Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
  linkedin: Boolean(config.LINKEDIN_CLIENT_ID && config.LINKEDIN_CLIENT_SECRET),
});
