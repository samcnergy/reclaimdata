import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const email = process.argv[2];
  const mode = process.argv[3] ?? "create";

  if (!email) {
    console.error("usage: create-test-user.ts <email> [create|delete]");
    process.exit(1);
  }

  if (mode === "delete") {
    const { data: listed } = await admin.auth.admin.listUsers();
    const u = listed?.users.find((u) => u.email === email);
    if (!u) {
      console.log(`no user found for ${email}`);
      return;
    }
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) throw error;
    console.log(`deleted ${email} (${u.id})`);
    return;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "Reclaim-Dev-M6-Test!",
    email_confirm: true,
    user_metadata: { full_name: "Milestone 6 Tester" },
  });
  if (error) throw error;
  console.log(`created ${email} (id=${data.user?.id})`);
  console.log(`password: Reclaim-Dev-M6-Test!`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
