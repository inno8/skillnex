import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

/**
 * Intercept POST /api/auth/sign-up/* — accounts must be created via
 * /api/signup, which calls auth.api.signUpEmail() programmatically (bypasses
 * this HTTP intercept). Direct HTTP signup is closed. Everything else
 * (sign-in, sign-out, email verification, password reset) passes through.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  if (url.pathname.includes("/sign-up")) {
    return Response.json(
      {
        error:
          "Public sign-up is disabled. Use /api/signup, which creates the tenant + Owner together.",
      },
      { status: 404 },
    );
  }
  return handlers.POST(req);
}
