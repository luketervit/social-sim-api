import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const AUDIENCES = [
  { file: "toxic_gamers.json", id: "toxic_gamers", name: "Toxic Gamers" },
  { file: "genz.json", id: "genz", name: "Gen Z" },
  { file: "engineers.json", id: "engineers", name: "Engineers" },
  { file: "small_town.json", id: "small_town", name: "Small Town" },
  { file: "company_internal.json", id: "company_internal", name: "Company Internal" },
];

async function seed() {
  console.log("Seeding audiences...");

  for (const aud of AUDIENCES) {
    const filePath = join(process.cwd(), "train", aud.file);
    const personas = JSON.parse(readFileSync(filePath, "utf-8"));

    const { error } = await supabase
      .from("audiences")
      .upsert({
        id: aud.id,
        name: aud.name,
        metadata: { source: aud.file, persona_count: personas.length },
        personas,
      });

    if (error) {
      console.error(`Failed to seed ${aud.id}:`, error.message);
    } else {
      console.log(`Seeded ${aud.id} (${personas.length} personas)`);
    }
  }

  console.log("Done.");
}

seed();
