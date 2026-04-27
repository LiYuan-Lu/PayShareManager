import { createHash, randomBytes, timingSafeEqual, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { redirect } from "react-router";

import type {
  DataRepositories,
  InviteCodeRecord,
  PasswordResetTokenRecord,
  UserRecord,
} from "./repositories/types";

const scrypt = promisify(scryptCallback);
const sessionCookieName = "payshare_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

let repositories: DataRepositories | null = null;

async function getRepositories() {
  if (!repositories) {
    const { getRepositories } = await import("./repositories/index.server.js");
    repositories = getRepositories();
  }
  return repositories;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseCookies(request: Request) {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  return new Map(
    cookieHeader
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separatorIndex = item.indexOf("=");
        if (separatorIndex === -1) {
          return [item, ""];
        }
        return [
          decodeURIComponent(item.slice(0, separatorIndex)),
          decodeURIComponent(item.slice(separatorIndex + 1)),
        ];
      })
  );
}

function getSessionId(request: Request) {
  return parseCookies(request).get(sessionCookieName) ?? null;
}

function shouldUseSecureCookies() {
  const configured = process.env.PAYSHARE_COOKIE_SECURE?.trim().toLowerCase();
  if (configured === "true" || configured === "1" || configured === "yes") {
    return true;
  }
  if (configured === "false" || configured === "0" || configured === "no") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

function createSessionCookie(sessionId: string) {
  const attributes = [
    `${sessionCookieName}=${encodeURIComponent(sessionId)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${sessionMaxAgeSeconds}`,
  ];
  if (shouldUseSecureCookies()) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

export function createLogoutCookie() {
  const attributes = [
    `${sessionCookieName}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (shouldUseSecureCookies()) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  if (passwordHash === "local-dev-password") {
    return false;
  }

  const [algorithm, salt, key] = passwordHash.split(":");
  if (algorithm !== "scrypt" || !salt || !key) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(key, "hex");
  if (storedKey.byteLength !== derivedKey.byteLength) {
    return false;
  }
  return timingSafeEqual(storedKey, derivedKey);
}

export async function getCurrentUser(request: Request): Promise<UserRecord | null> {
  const sessionId = getSessionId(request);
  if (!sessionId) {
    return null;
  }
  const repository = await getRepositories();
  return repository.getSessionUser(sessionId);
}

export async function requireUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    const url = new URL(request.url);
    throw redirect(`/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
  }
  return user;
}

export async function requireUserId(request: Request) {
  const user = await requireUser(request);
  return user.uniqueId;
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (user.role !== "admin") {
    throw new Response("Not Found", { status: 404 });
  }
  return user;
}

export async function updateCurrentUserProfile(userId: string, values: { name: string }) {
  const repository = await getRepositories();
  const name = values.name.trim();
  if (!name) {
    throw new Error("Name is required.");
  }
  if (name.length > 80) {
    throw new Error("Name must be 80 characters or fewer.");
  }
  return repository.updateUserProfile(userId, { name });
}

export function createTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createUrlToken() {
  return randomBytes(32).toString("base64url");
}

export async function registerUser(values: {
  email: string;
  name: string;
  password: string;
  inviteCode?: string;
}) {
  const repository = await getRepositories();
  const email = normalizeEmail(values.email);
  const existingUser = await repository.getUserByEmail(email);
  if (existingUser) {
    throw new Error("An account with this email already exists.");
  }

  const inviteCodeRequired = await repository.hasActiveInviteCodes();
  const inviteCode = values.inviteCode?.trim() ?? "";
  if (inviteCodeRequired) {
    const validInviteCode = await repository.validateInviteCode(inviteCode);
    if (!validInviteCode) {
      throw new Error("A valid invite code is required.");
    }
  }

  const passwordHash = await hashPassword(values.password);
  const user = await repository.createUser({
    email,
    name: values.name.trim() || email.split("@")[0],
    passwordHash,
  });
  if (inviteCodeRequired) {
    await repository.markInviteCodeUsed(inviteCode, user.uniqueId);
  }
  return user;
}

export async function loginUser(emailInput: string, password: string) {
  const repository = await getRepositories();
  const email = normalizeEmail(emailInput);
  const [user, passwordHash] = await Promise.all([
    repository.getUserByEmail(email),
    repository.getUserPasswordHash(email),
  ]);
  if (!user || !passwordHash || !(await verifyPassword(password, passwordHash))) {
    throw new Error("Invalid email or password.");
  }
  return user;
}

export async function createUserSession(userId: string, redirectTo = "/") {
  const repository = await getRepositories();
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString();
  const sessionId = await repository.createSession(userId, expiresAt);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": createSessionCookie(sessionId),
    },
  });
}

export async function logout(request: Request) {
  const sessionId = getSessionId(request);
  if (sessionId) {
    const repository = await getRepositories();
    await repository.deleteSession(sessionId);
  }
  return redirect("/login", {
    headers: {
      "Set-Cookie": createLogoutCookie(),
    },
  });
}

export async function getInviteCodes() {
  const repository = await getRepositories();
  return repository.getInviteCodes();
}

export async function createInviteCode(
  adminUserId: string,
  values: { code?: string; maxUses?: number | null; expiresAt?: string | null }
): Promise<InviteCodeRecord> {
  const repository = await getRepositories();
  const code = (values.code?.trim() || randomBytes(6).toString("base64url")).toUpperCase();
  const maxUses =
    values.maxUses === null || values.maxUses === undefined
      ? null
      : Math.max(1, Math.floor(values.maxUses));
  return repository.createInviteCode(adminUserId, {
    code,
    maxUses,
    expiresAt: values.expiresAt ?? null,
  });
}

export async function disableInviteCode(adminUserId: string, code: string) {
  const repository = await getRepositories();
  await repository.disableInviteCode(adminUserId, code.trim().toUpperCase());
}

export async function createManualPasswordReset(
  adminUserId: string,
  userEmail: string
): Promise<PasswordResetTokenRecord> {
  const repository = await getRepositories();
  const token = createUrlToken();
  const tokenHash = createTokenHash(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
  const resetToken = await repository.createPasswordResetToken(
    adminUserId,
    userEmail.trim().toLowerCase(),
    tokenHash,
    expiresAt
  );
  return { ...resetToken, token };
}

export async function getPasswordResetToken(token: string) {
  const repository = await getRepositories();
  return repository.getPasswordResetToken(createTokenHash(token));
}

export async function resetPasswordWithToken(token: string, password: string) {
  const repository = await getRepositories();
  const tokenHash = createTokenHash(token);
  const resetToken = await repository.getPasswordResetToken(tokenHash);
  if (!resetToken) {
    throw new Error("This reset link is invalid or has expired.");
  }
  const passwordHash = await hashPassword(password);
  await repository.markPasswordResetTokenUsed(tokenHash, passwordHash);
}

export function getSafeRedirectTo(value: FormDataEntryValue | string | null, fallback = "/") {
  const redirectTo = typeof value === "string" ? value : fallback;
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return fallback;
  }
  return redirectTo;
}

export function getPasswordFingerprint(passwordHash: string) {
  return createHash("sha256").update(passwordHash).digest("hex");
}
