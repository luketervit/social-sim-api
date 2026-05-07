import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeLinkedInGlobalEval } from "@/lib/evals/linkedinGlobal";

async function main() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("audiences")
    .select("owner_user_id, metadata")
    .eq("platform", "linkedin")
    .eq("status", "ready");

  if (error) {
    console.error("Failed to load LinkedIn audiences:", error.message);
    process.exitCode = 1;
    return;
  }

  const summary = computeLinkedInGlobalEval(data ?? []);
  if (!summary) {
    console.error("No usable LinkedIn exports found.");
    process.exitCode = 1;
    return;
  }

  console.log("LinkedIn global eval");
  console.log(`accounts=${summary.account_count} audiences=${summary.audience_count} posts=${summary.post_count}`);
  console.log(`mean_spearman=${summary.mean_spearman_rank_correlation?.toFixed(3) ?? "n/a"}`);
  console.log(`weighted_mean_spearman=${summary.weighted_mean_spearman_rank_correlation?.toFixed(3) ?? "n/a"}`);
  console.log(`mean_top_quartile_overlap=${summary.mean_top_quartile_overlap?.toFixed(3) ?? "n/a"}`);
  console.log(`weighted_mean_top_quartile_overlap=${summary.weighted_mean_top_quartile_overlap?.toFixed(3) ?? "n/a"}`);
  console.log("");
  console.log("What tends to work:");
  for (const item of summary.strongest_positive_signals) {
    console.log(`- ${item.interpretation}: corr=${item.correlation.toFixed(3)}`);
  }
  console.log("");
  console.log("What tends to underperform:");
  for (const item of summary.strongest_negative_signals) {
    console.log(`- ${item.interpretation}: corr=${item.correlation.toFixed(3)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
