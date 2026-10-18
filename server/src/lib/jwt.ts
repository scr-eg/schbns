// worker/src/lib/jwt.ts
import { SignJWT, jwtVerify } from "jose";

export interface AccessTokenPayload {
  sub: string;       // user id
  roleCode: string;  // e.g. "teacher"
  linkedEntityType?: string;
  linkedEntityId?: string;
}

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 دقيقة

export async function signAccessToken(payload: AccessTokenPayload, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifyAccessToken(token: string, secret: string): Promise<AccessTokenPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return payload as unknown as AccessTokenPayload;
}
