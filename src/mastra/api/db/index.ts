import { drizzle } from "drizzle-orm/postgres-js";

const db = drizzle(process.env.DB_URL!);

export { db };
