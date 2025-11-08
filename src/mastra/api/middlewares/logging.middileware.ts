import { Context, Next } from "hono";

const loggingMiddleware = async (c: Context, next: Next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`${c.req.method} ${c.req.url} - ${duration}ms - ${c.res.status}`);
};

export default loggingMiddleware;
