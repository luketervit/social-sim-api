import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseLinkedInCompleteExportAttachment } from "@/lib/audiences/linkedinExport";
import { evaluateLinkedInPrivateDataset } from "@/lib/evals/linkedinPrivate";
import { synthesizePersona } from "@/lib/audiences/synthesize";
import { parseUpload } from "@/lib/audiences/parse";

async function main() {
  const zipArg = process.argv[2];
  if (!zipArg) {
    console.error("Usage: npm run eval:linkedin:private -- /abs/path/to/Complete_LinkedInDataExport.zip");
    process.exitCode = 1;
    return;
  }

  const zipPath = resolve(zipArg);
  const file = await readFile(zipPath);
  const parsed = parseLinkedInCompleteExportAttachment(new Uint8Array(file));

  if (!parsed.connections_csv) {
    console.error("Connections.csv not found in export.");
    process.exitCode = 1;
    return;
  }
  if (!parsed.attachment) {
    console.error("Complete post-history files not found in export.");
    process.exitCode = 1;
    return;
  }

  const parsedConnections = parseUpload(parsed.connections_csv, "Connections.csv");
  const personas = parsedConnections.rows.map((row) =>
    synthesizePersona("private-eval", row, {})
  );
  const result = evaluateLinkedInPrivateDataset(personas, parsed.attachment.posts);

  if (!result) {
    console.error("Could not evaluate dataset.");
    process.exitCode = 1;
    return;
  }

  console.log(`LinkedIn private eval: ${zipPath}`);
  console.log(`connections=${personas.length} posts=${parsed.attachment.summary.post_count}`);
  console.log(`comments=${parsed.attachment.summary.comment_count} reactions=${parsed.attachment.summary.reaction_count} reposts=${parsed.attachment.summary.repost_count}`);
  console.log(`sample_size=${result.sample_size}`);
  console.log(`spearman_rank_correlation=${result.spearman_rank_correlation?.toFixed(3) ?? "n/a"}`);
  console.log(`top_quartile_overlap=${result.top_quartile_overlap?.toFixed(3) ?? "n/a"}`);
  console.log(`avg_actual_engagement_of_top_predicted=${result.avg_actual_engagement_of_top_predicted?.toFixed(2) ?? "n/a"}`);
  console.log(`avg_actual_engagement_overall=${result.avg_actual_engagement_overall?.toFixed(2) ?? "n/a"}`);
  console.log("");
  console.log("Top predicted posts:");
  for (const example of result.examples) {
    console.log(`- predicted=${example.predicted_qes.toFixed(3)} actual=${example.actual_weighted_engagement} ${example.text_preview}`);
  }
  console.log("");
  console.log("Most overpredicted:");
  for (const example of result.overpredicted_examples) {
    console.log(`- predicted_rank=${example.predicted_rank} actual_rank=${example.actual_rank} predicted=${example.predicted_qes.toFixed(3)} actual=${example.actual_weighted_engagement} ${example.text_preview}`);
  }
  console.log("");
  console.log("Most underpredicted:");
  for (const example of result.underpredicted_examples) {
    console.log(`- predicted_rank=${example.predicted_rank} actual_rank=${example.actual_rank} predicted=${example.predicted_qes.toFixed(3)} actual=${example.actual_weighted_engagement} ${example.text_preview}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
