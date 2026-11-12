import { defineCommand } from "just-bash";
import { callFunction, describeFunction, functions, searchFunctions } from "../shared/erp.ts";

// A link is only useful in a form the model can run, so here every link becomes a command line.
function toText(value: unknown) {
  return JSON.stringify(
    value,
    (_key, part) => {
      if (!part?.function) {
        return part;
      }
      const flags = Object.entries(part.args).map(([name, arg]) => `--${name} ${arg}`);
      return `erp ${part.function} ${flags.join(" ")}`;
    },
    2,
  );
}

const print = (value: unknown) => ({ stdout: `${toText(value)}\n`, stderr: "", exitCode: 0 });
const fail = (value: unknown) => ({ stdout: "", stderr: `${toText(value)}\n`, exitCode: 1 });

// "--status overdue --limit 2" becomes { status: "overdue", limit: 2 }.
function parseFlags(flags: string[]) {
  const args: Record<string, string | number> = {};
  for (let i = 0; i < flags.length; i += 2) {
    const value = flags[i + 1];
    args[flags[i].replace(/^--/, "")] = Number.isNaN(Number(value)) ? value : Number(value);
  }
  return args;
}

// One command for the whole ERP: the functions become subcommands.
export const erp = defineCommand("erp", async (argv) => {
  // Breakpoint 10.1: argv as just-bash parsed the command line.
  const [subcommand, ...rest] = argv;

  if (!subcommand || subcommand === "--help") {
    return print({
      usage: [
        "erp search <keywords>",
        "erp <function> --help",
        "erp <function> [--name value ...] [--all]",
      ],
      note: "Output is JSON. --all follows next_cursor and returns every page.",
      function_count: functions.length,
    });
  }

  if (subcommand === "search") {
    return print(searchFunctions(rest.join(" ")));
  }

  if (rest.includes("--help")) {
    const description = describeFunction(subcommand);
    return "error" in description ? fail(description) : print(description);
  }

  const all = rest.includes("--all");
  const isList = functions.find(({ name }) => name === subcommand)?.parameters.properties.cursor;
  if (all && !isList) {
    return fail({ error: "--all only works with functions that return pages." });
  }

  const args = parseFlags(rest.filter((flag) => flag !== "--all"));
  let result: any = callFunction(subcommand, args);
  if (result.error) {
    return fail(result);
  }

  // Paging happens inside the command, so the pages never reach the model.
  if (all) {
    const items = [...result.items];
    while (result.page?.next_cursor) {
      // Breakpoint 10.2: paging inside the command, invisible to the model.
      result = callFunction(subcommand, { ...args, cursor: result.page.next_cursor });
      items.push(...result.items);
    }
    return print({ items });
  }

  return print(result);
});
