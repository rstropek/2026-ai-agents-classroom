# Session 1 storybook: designing function tools

**Classroom: Moderne KI-Agents entwickeln, session 1, third part**

This is the live-demo script for the two code examples in the tool design part of session 1. The concepts live in the Slidev deck, [slides.md](slides.md), with speaker notes on every slide. Each step here has a **Goal**, the **Prompt** for your coding agent if you'd rather build the demo live, the command to **Run**, **Teaching points** to narrate, and a **Verify** checklist. Step numbers continue from the function calling APIs part, and the finished code sits in one numbered folder per step, next to this file.

## The idea of this part

The deck walks through a fictional ERP vendor that wants agents in its product and has thousands of functions. Two of its stages get code. Step 9 shows stage 3, where three generic tools search, describe, and call any function. Step 10 shows stage 4, where the same functions become a command inside a simulated Bash.

Both examples are deliberately tiny. They show how an approach looks technically and nothing more. The case study's requirements are invented, so don't measure tokens or compare the two runs as if one had won. Participants need to plan and measure on their own systems, and the last slide says so.

Both steps use the same four functions from `shared/erp.ts` and the same agent loop from `shared/agent.ts`, so only the tools differ between them.

## Prerequisites

You need Node.js 24 or newer and the `.env` file in the repository root with `OPENAI_API_KEY`. Install the packages in this folder:

```bash
npm install
```

Start the deck with `npm run slides`. Run `npm run slides:export` for a PDF.

**Participants.** `npm run 10:bash` needs no key at all. The two agent demos call the OpenAI Responses API directly with `gpt-6-luna`, which is the `MODEL` constant in `shared/agent.ts`. Azure Foundry needs a different client setup in that file and is untested.

## Step 9: generic tools for search and call

This step belongs to the slide "Demo: stage 3 in code".

**Goal.** Give the model three fixed tools that reach every ERP function, and watch it find a function, read its parameters, page through a list, and recover from a refused write.

**Prompt.**

> Write a small in-memory ERP in TypeScript with four functions: invoice.list with cursor paging, a default page size of 3 and a maximum of 5, customer.get, credit_note.create, which refuses amounts above 200 EUR and names credit_note.request_approval as the next step, and credit_note.request_approval. Invoices link to their customer with the function name and arguments. Add searchFunctions, describeFunction, and callFunction, where callFunction rejects missing and unknown arguments. Then write an agent loop with the OpenAI Responses API and expose only three tools: search_functions, describe_function, and call_function. The question is: "Which customer has the highest total overdue amount? Please issue a credit note of 500 EUR on that customer's largest overdue invoice." Print each tool call with its result.

**Run.**

```bash
npm run 09:generic
```

A real run looks like this, with long lines cut at `...`:

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
```

Your run will differ. Some runs skip a `describe_function` or look up the customer later.

Open `09-generic-tools/main.ts`, then `invoice.list` and `callFunction` in `shared/erp.ts`.

**Teaching points.**

- The tool list has three entries and stays that way. A new function in `shared/erp.ts` changes nothing the model sees in its first request.
- `call_function` can't be strict, because `args` differs per function. That's why `callFunction` checks missing and unknown arguments itself, and why its error returns the parameter list.
- The model often asks for more rows than the ERP gives it. `invoice.list` caps the page at 5 and returns `next_cursor`, so the model has to come back for the rest.
- Every page lands in the context, and the model adds up the amounts itself. Use this as the bridge to the slide on what stages 1 to 3 can't do on their own.
- The refused credit note is the moment to slow down. The model reads `next_step` and asks for approval, and the final answer says the credit note isn't issued yet.

**Verify.**

- [ ] The output contains at least one `search_functions` and one `call_function`.
- [ ] The answer names Alpenblick Hotel GmbH with 4,900 EUR and invoice R-15.
- [ ] `credit_note.create` returns an error with `next_step`, and `credit_note.request_approval` follows.
- [ ] No output claims that the credit note was created.

## Step 10: the ERP as a command in just-bash

This step belongs to the slides on just-bash and "Demo: stage 4 in code".

**Goal.** Turn the same functions into one command inside a simulated Bash, first without a model so that participants see ordinary shell commands, then as the only tool of an agent.

**Prompt.**

> Install just-bash and use defineCommand to register one command called erp on top of the functions in shared/erp.ts. It supports `erp --help`, `erp search <keywords>`, `erp <function> --help`, and `erp <function> --name value`. Add an --all flag that follows next_cursor inside the command and fails for functions that have no pages. Print JSON, turn every link in the output into a runnable command line, and return errors on stderr with exit code 1. Write one script that runs a few commands through bash.exec without any LLM, including a jq pipeline that totals overdue amounts per customer. Write a second script that reuses the agent loop with a single tool called bash, and cap the tool output with a hint that says it was cut.

**Run without a model.**

```bash
npm run 10:bash
```

The two commands to stop at:

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

A real run, showing only the commands the model wrote and its answer:

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
```

With only seven overdue invoices the model usually reads the JSON directly instead of writing a pipeline, and that's a reasonable choice for so little data. Show the pipeline from `npm run 10:bash` for the composition, and say openly that the model decides which form it uses.

Open `10-bash-tools/erp-command.ts` and `10-bash-tools/main.ts`.

**Teaching points.**

- There's one command for the whole catalog. `defineCommand` registers `erp`, and the functions become its subcommands.
- `--all` follows the cursors inside the command, so the pages never reach the model. Compare that with the two `invoice.list` calls in step 9.
- A link has to be in a form the model can run. `erp-command.ts` turns every `{function, args}` into a command line in one place.
- Discovery round trips don't go away. The model still needs `erp --help` and `erp search` to find its way around.
- The tool output has its own limit, and the text says that it cut something.
- The 200 EUR rule lives in `credit_note.create`, so it holds in both steps. It's per call, though, and a `for` loop with three credit notes of 200 EUR passes it three times. Real limits need cumulative state in the ERP.
- A sandbox protects the host and leaves the ERP data exposed to whatever the user is allowed to do. The `erp` command is ordinary TypeScript in the host process, and just-bash describes itself as beta software that runs without VM isolation.

**Verify.**

- [ ] `npm run 10:bash` prints the totals C-1 4900, C-3 4200, and C-2 3350.
- [ ] The refused credit note exits with code 1 and shows a runnable `next_step`.
- [ ] `npm run 10:agent` reaches the same customer and invoice as step 9.
- [ ] The agent only ever calls the tool `bash`.

## What participants have now

Participants have seen two ways to expose a large catalog without attaching every function as a tool, with the same functions and the same question behind both. They also have a list of questions for choosing a stage in their own project. Session 2 continues with the Model Context Protocol, which is how tools like these reach other clients.
