import { Context, Next } from "hono";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { MESSAGE } from "../constants/message";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID!,
});

const authenticationMiddleware = async (c: Context, next: Next) => {
  if (c.req.path === "/health") {
    await next();
    return;
  }

  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    return c.json({ error: MESSAGE.UNAUTHORIZED }, 401);
  }

  try {
    const payload = await verifier.verify(authHeader.replace("Bearer ", ""));
    c.set("user", payload);
  } catch {
    return c.json({ error: MESSAGE.UNAUTHORIZED }, 401);
  }

  await next();
};

export default authenticationMiddleware;
