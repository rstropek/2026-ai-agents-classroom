import { Bash } from "just-bash";
import { erp } from "./erp-command.ts";

// No LLM in this file. These are the commands a model could write.
const bash = new Bash({ customCommands: [erp] });

const commands = [
  "erp --help",
  "erp search credit",
  "erp invoice.list --help",
  "erp invoice.list --status overdue --limit 2",
  // A pipeline: all pages, grouped by customer, biggest total first.
  `erp invoice.list --status overdue --all \\
  | jq -r '.items | group_by(.customer_id)
           | map({customer: .[0].customer_id, total: (map(.amount) | add)})
           | sort_by(-.total) | .[] | "\\(.customer) \\(.total)"'`,
  "erp credit_note.create --invoice_id R-15 --amount 500",
];

for (const command of commands) {
  const { stdout, stderr, exitCode } = await bash.exec(command);
  console.log(`\n$ ${command}\n${stdout}${stderr}[exit code ${exitCode}]`);
}
