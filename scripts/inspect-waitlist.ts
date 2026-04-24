import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const sql = postgres(process.env.SUPABASE_DB_URL!, { max: 1, prepare: false });

async function main() {
  const email = process.argv[2];
  const shouldDelete = process.argv.includes("--delete");

  if (!email) {
    const rows = await sql`SELECT COUNT(*) AS n FROM waitlist`;
    console.log("waitlist rows:", rows[0].n);
  } else {
    const rows = await sql`
      SELECT id, email, company, industry, approximate_customer_count, source, created_at
      FROM waitlist WHERE email = ${email}
    `;
    console.log(rows);
    if (shouldDelete) {
      await sql`DELETE FROM waitlist WHERE email = ${email}`;
      console.log(`deleted ${email}`);
    }
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
