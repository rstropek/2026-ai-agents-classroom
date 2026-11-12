# Session 1 storybook: designing function tools

**Classroom: Moderne KI-Agents entwickeln, session 1, third part**

This storybook walks you through the two code samples in the tool design part of session 1. The concepts live in the Slidev deck, [slides.md](slides.md), with notes on every slide. Each step here has a **Goal**, the command to **Run**, a **Walkthrough** of the code, the breakpoints to set under **Debug**, and a **Verify** checklist. Step numbers continue from the function calling APIs part, and the code sits in one numbered folder per step, next to this file.

## The idea of this part

The deck walks through a fictional ERP vendor that wants agents in its product and has thousands of functions. Two of its stages get code. Step 9 shows stage 3, where three generic tools search, describe, and call any function. Step 10 shows stage 4, where the same functions become a command inside a simulated Bash.

Both samples are deliberately tiny. They show how an approach looks technically and nothing more. The case study's requirements are invented, so don't measure tokens or compare the two runs as if one had won. Plan and measure on your own systems, as the last slide says.

Both steps use the same four functions from `shared/erp.ts` and the same agent loop from `shared/agent.ts`, so only the tools differ between them.

## Prerequisites

You need Node.js 24 or newer, Visual Studio Code, and the `.env` file in the repository root with `OPENAI_API_KEY`. Install the packages in this folder:

```bash
npm install
```

Start the deck with `npm run slides`. Run `npm run slides:export` for a PDF.

**Which key.** `npm run 10:bash` needs no key at all. The two agent samples call the OpenAI Responses API directly with `gpt-6-luna`, which is the `MODEL` constant in `shared/agent.ts`. Azure Foundry needs a different client setup in that file and is untested.

## Debugging the samples

Open the repository root as the folder in Visual Studio Code, because the launch configuration reads `.env` from there. Open a sample file, set the breakpoints for the step, pick **Debug current sample file** in the Run and Debug view, and press F5.

Every place worth stopping at carries a marker comment such as `// Breakpoint 9.1: one tool call, its result, and the growing input.` Set the breakpoint on the first code line below the marker. A search for `Breakpoint 9.` finds all markers of step 9. Several markers sit in `shared/`, so they stop in both steps.

The fundamentals storybook explains the Variables, Watch, Debug Console, and Call Stack panes.

## Step 9: generic tools for search and call

This step belongs to the slide "Demo: stage 3 in code".

**Goal.** Give the model three fixed tools that reach every ERP function, and watch it find a function, read its parameters, page through a list, and recover from a refused write.

**Run.**

```bash
npm run 09:generic
```

A run looks like this, with long lines cut at `...`:

```text
search_functions {"query":"customer accounts receivable overdue invoices balances aging total overdue amount list invoices by cust...
  -> [{"name":"invoice.list","description":"List invoices, optionally by status. Returns one page at a time."},...

describe_function {"name":"invoice.list"}
  -> {"name":"invoice.list","description":"List invoices, optionally by status. Returns one page at a time.","parameters":...

describe_function {"name":"credit_note.create"}
  -> {"name":"credit_note.create","description":"Create a credit note for an invoice.","parameters":...

call_function {"name":"invoice.list","args":{"status":"overdue","limit":5}}
  -> {"items":[{"id":"R-11","customer_id":"C-1","amount":1200,"status":"overdue","links":{"customer":{"function":"customer.get",...

call_function {"name":"invoice.list","args":{"status":"overdue","limit":5,"cursor":"5"}}
  -> {"items":[{"id":"R-18","customer_id":"C-1","amount":800,"status":"overdue","links":{"customer":{"function":"customer.get",...

describe_function {"name":"customer.get"}
  -> {"name":"customer.get","description":"Get one customer by id.","parameters":...

call_function {"name":"customer.get","args":{"id":"C-1"}}
  -> {"id":"C-1","name":"Alpenblick Hotel GmbH"}

call_function {"name":"credit_note.create","args":{"invoice_id":"R-15","amount":500}}
  -> {"error":"Credit notes above 200 EUR need an approval.","next_step":{"function":"credit_note.request_approval",...

describe_function {"name":"credit_note.request_approval"}
  -> {"name":"credit_note.request_approval","description":"Ask a manager to approve a credit note above the limit.","parameters":...

call_function {"name":"credit_note.request_approval","args":{"invoice_id":"R-15","amount":500}}
  -> {"approval_id":"A-1","invoice_id":"R-15","amount":500,"status":"pending"}

Final answer: Alpenblick Hotel GmbH has the highest total overdue amount: **€4,900**. Its largest overdue invoice is **R-15 (€2,900)**.

I submitted a request for a **€500** credit note ... **pending** (approval ID **A-1**), so it has not yet been issued.
```

Your run will differ. Some runs skip a `describe_function`, look up the customer later, or never call `customer.get` and name the customer only by its id, C-1. The question doesn't ask for the name, so that's a fair reading.

**Walkthrough.** Read the files in this order.

1. `shared/erp.ts` is the ERP. Four functions with a name, a description, keywords, and a JSON schema, plus `searchFunctions`, `describeFunction`, and `callFunction` on top.
2. `shared/agent.ts` is the agent loop with the Responses API. It knows nothing about the ERP and gets tools and handlers from outside.
3. `09-generic-tools/main.ts` connects the two with three tools.

Things to look for:

- The tool list has three entries and stays that way. A new function in `shared/erp.ts` changes nothing the model sees in its first request.
- `call_function` can't be strict, because `args` differs per function. That's why `callFunction` checks missing and unknown arguments itself, and why its error returns the parameter list.
- The model usually asks for the maximum page size of 5. With seven overdue invoices that still isn't enough, and `invoice.list` returns `next_cursor`, so the model has to come back for the rest.
- Every page lands in the context, and the model adds up the amounts itself. Keep that in mind for the slide on what stages 1 to 3 can't do on their own.
- The refused credit note is the interesting moment. The model reads `next_step` and asks for approval, and the final answer says the credit note isn't issued yet.

**Debug.** Set breakpoints 9.1 to 9.3 and debug `09-generic-tools/main.ts`.

- **Breakpoint 9.1, one tool call and the growing input.** This stops after every tool call. Add `input.length` and `JSON.stringify(input).length` to Watch. The second number is roughly the size of the context in characters, and it jumps after every `invoice.list` page. The current call's `output` goes into `input` right after this line, so you see the jump at the next stop. If you only want the ERP calls, make it a conditional breakpoint with `call.name === "call_function"`.
- **Breakpoint 9.2, args as the model wrote them.** Expand `args`, `missing`, and `unknown`. Without strict mode, nothing but this check stands between the model's JSON and your function. Look out for a run where the model writes a wrong parameter name: the error that comes back lists the right ones.
- **Breakpoint 9.3, the amount before the limit check.** `amount` is 500, so the next line refuses the credit note. Press F10 to step into the refusal branch, then continue with F5. Breakpoint 9.1 shows you the refusal in `output`: an `error` that says why, and a `next_step` that says which call to make instead.

**Try it.** Stop at breakpoint 9.3 again and change `amount` to `150` in Variables before you continue. The ERP now creates a credit note of 150 EUR. Read the final answer: the model only knows what the tool returned, and it has to notice that 150 isn't the 500 it asked for.

**Verify.**

- [ ] The output contains at least one `search_functions` and one `call_function`.
- [ ] The answer names Alpenblick Hotel GmbH (or its id, C-1) with 4,900 EUR and invoice R-15.
- [ ] `credit_note.create` returns an error with `next_step`, and `credit_note.request_approval` follows.
- [ ] No output claims that the credit note was created.

## Step 10: the ERP as a command in just-bash

This step belongs to the slides on just-bash and "Demo: stage 4 in code".

**Goal.** Turn the same functions into one command inside a simulated Bash, first without a model so that you see ordinary shell commands, then as the only tool of an agent.

**Run without a model.**

```bash
npm run 10:bash
```

The two commands to look at closely:

```text
$ erp invoice.list --status overdue --all \
  | jq -r '.items | group_by(.customer_id)
           | map({customer: .[0].customer_id, total: (map(.amount) | add)})
           | sort_by(-.total) | .[] | "\(.customer) \(.total)"'
C-1 4900
C-3 4200
C-2 3350
[exit code 0]

$ erp credit_note.create --invoice_id R-15 --amount 500
{
  "error": "Credit notes above 200 EUR need an approval.",
  "next_step": "erp credit_note.request_approval --invoice_id R-15 --amount 500"
}
[exit code 1]
```

**Run with a model.**

```bash
npm run 10:agent
```

A run, showing only the commands the model wrote and its answer:

```text
bash {"command":"erp --help"}
bash {"command":"erp search invoice overdue"}
bash {"command":"erp invoice.list --help"}
bash {"command":"erp credit_note.create --help"}
bash {"command":"erp invoice.list --status overdue --all"}
bash {"command":"erp search customer"}
bash {"command":"erp credit_note.create --invoice_id R-15 --amount 500"}
bash {"command":"erp customer.get --help"}
bash {"command":"erp search credit_note approval"}
bash {"command":"erp customer.get --id C-1"}
bash {"command":"erp credit_note.request_approval --help"}
bash {"command":"erp credit_note.request_approval --invoice_id R-15 --amount 500"}
bash {"command":"erp search approval"}
Final answer: Alpenblick Hotel GmbH has the highest total overdue amount: **€4,900**. Its largest overdue invoice is **R-15 (€2,900)**.

I submitted a request for a **€500** credit note ... **pending** (approval ID **A-1**), so it has not yet been issued.
```

With only seven overdue invoices the model usually reads the JSON directly instead of writing a pipeline, and that's a reasonable choice for so little data. The pipeline from `npm run 10:bash` shows the composition. The model decides which form it uses.

**Walkthrough.** Open `10-bash-tools/erp-command.ts`, then `10-bash-tools/try-bash.ts`, then `10-bash-tools/main.ts`.

- There's one command for the whole catalog. `defineCommand` registers `erp`, and the functions become its subcommands.
- `--all` follows the cursors inside the command, so the pages never reach the model. Compare that with the two `invoice.list` calls in step 9.
- A link has to be in a form the model can run. `toText` in `erp-command.ts` turns every `{function, args}` into a command line in one place.
- `try-bash.ts` runs commands through `bash.exec` with no model involved. These are exactly the commands a model could write.
- Discovery round trips don't go away. The model still needs `erp --help` and `erp search` to find its way around.
- The tool output in `main.ts` has its own limit, and the text says that it cut something.
- The 200 EUR rule lives in `credit_note.create`, so it holds in both steps. It's per call, though, and a `for` loop with three credit notes of 200 EUR passes it three times. Real limits need cumulative state in the ERP.
- A sandbox protects the host and leaves the ERP data exposed to whatever the user is allowed to do. The `erp` command is ordinary TypeScript in the host process, and just-bash describes itself as beta software that runs without VM isolation.

**Debug.** Breakpoints 10.1 and 10.2 work without a key, so start with `10-bash-tools/try-bash.ts`. Disable the step 9 breakpoints first. Breakpoints 9.2 and 9.3 sit in `shared/erp.ts`, which the `erp` command calls too, so 9.2 would otherwise stop on almost every `erp` command, including each page inside `--all`.

- **Breakpoint 10.1, argv as just-bash parsed it.** This stops once per `erp` command. Expand `argv`. It's an array of strings, already split by the shell. For the pipeline, `argv` holds only `invoice.list --status overdue --all`, because just-bash runs `jq` separately and connects the two through a pipe.
- **Breakpoint 10.2, paging inside the command.** This stops on the pipeline, and in `main.ts` whenever the model uses `--all`. Watch `items.length` and `result.page.next_cursor` across the loop. The command doesn't pass `--limit`, so `invoice.list` uses its default page size of 3. The first page comes before the loop, so the breakpoint stops twice: `items.length` is 3, then 6, and the result ends with all 7 invoices. The model only ever sees the final JSON.

Then debug `10-bash-tools/main.ts` with breakpoints 10.1 and 10.3. Breakpoint 9.1 in `shared/agent.ts` stops here too, if you still have it enabled.

- **Breakpoint 10.3, the result of the model's command.** Hover over `command` to see what the model wrote, then expand `stdout`, `stderr`, and `exitCode`. For the refused credit note, `stdout` is empty, the error is in `stderr`, and `exitCode` is 1. The model gets all three, joined into one string.

**Try it.** Set `MAX_OUTPUT` in `main.ts` to `300` and run `npm run 10:agent` again. The `--all` output no longer fits, and neither does the `--help` output of most functions, so the model now loses parameter docs too. Watch how it reacts to the cut hint: with `jq`, with `head`, or by paging on its own. It can still reach the same answer.

**Verify.**

- [ ] `npm run 10:bash` prints the totals C-1 4900, C-3 4200, and C-2 3350.
- [ ] The refused credit note exits with code 1 and shows a runnable `next_step`.
- [ ] `npm run 10:agent` reaches the same customer and invoice as step 9.
- [ ] The agent only ever calls the tool `bash`.

## What you have now

You have seen two ways to expose a large catalog without attaching every function as a tool, with the same functions and the same question behind both. The deck adds a list of questions for choosing a stage in your own project. Session 2 continues with the Model Context Protocol, which is how tools like these reach other clients.
