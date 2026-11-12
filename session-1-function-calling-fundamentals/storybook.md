# Session 1 storybook: function calling fundamentals

**Classroom: Moderne KI-Agents entwickeln, session 1, first part**

This is the live-demo script for the opening of session 1. Each step has a **Goal**, the **Prompt** for your coding agent if you'd rather build the demo live, the command to **Run**, **Teaching points** to narrate, and a **Verify** checklist. The finished code sits in one numbered folder per step, next to this file.

## The idea of this part

Participants already call models with tools. Most of them treat the path between their JSON and the model as magic, so this part follows one request along that path. The sentence to leave them with is this one: a function call is text that the model writes and a parser recognizes.

```
OpenAI Chat Completions JSON     Anthropic Messages JSON      steps 1 to 3
                  \                 /
                   v               v
          API layer: reads messages and tools
                           |
                           v
          chat template: one string with special tokens       step 4
                           |
                           v
          model: continues the text                           step 5
                           |
                           v
          parser: finds the tool call in the generated text   step 5
                           |
                           v
          API response: tool_calls or tool_use as JSON        steps 1 and 2
```

The API formats differ at the top. Below the API layer, the model works on one string, and template and parser belong to the specific model. The demo uses two open-weight models for that lower half, gpt-oss and Qwen 3.5, because their templates are public. Closed models such as Claude don't publish theirs, so you can only look inside on an open-weight model.

All five steps use the same question ("What is the weather in Linz?") and the same `get_weather` tool. Only the layer changes, so participants can compare the outputs directly. The tool returns fixed fog data, because the weather isn't the lesson.

## Step 0: prerequisites (before the session)

You need Node.js 24 or newer, `curl`, and `jq`. Node 24 runs TypeScript files directly, so none of the demos has a build step.

Create `.env` in the repository root with your key:

```
OPENROUTER_API_KEY=...
```

Then install the packages in this folder:

```bash
npm install
```

A full run of all five steps costs well below one cent on OpenRouter.

**Participants.** The announcement asks participants for an OpenAI key or Azure Foundry access. Steps 1 and 2 only use the standard Chat Completions API. Step 1 contains a commented-out OpenAI block with `gpt-5.4-mini` and `OPENAI_API_KEY`, which participants swap for the OpenRouter block. The step 2 file explains in its header comment which URL, model, and key to change for OpenAI. Both are tested against the OpenAI API. Step 4 needs no key at all. Steps 3 and 5 depend on OpenRouter, so participants without an OpenRouter key watch them on your screen.

## Step 1: the developer's view

**Goal.** Run a complete function call with the OpenAI SDK, in the form participants know from their own projects.

**Prompt.**

> Write a minimal TypeScript script that uses the OpenAI SDK against OpenRouter with openai/gpt-oss-20b. Define one get_weather tool, run one full function-calling round trip, and log what happens at each stage. No structured outputs, no helper libraries, no loop abstraction.

**Run.**

```bash
npm run 01:sdk
```

```
Model asks for: get_weather({"city":"Linz"})
Our code returns: {"city":"Linz","temperature":7,"condition":"fog"}
Final answer: In Linz the current weather is a cool 7 °C with fog.
```

**Teaching points.**

- The model can't run anything. It asks for a call, and `getWeather` runs in your process. Every security question later in this course follows from that split.
- `arguments` arrives as a JSON string, and the model wrote that string. `JSON.parse` can fail, and the content can be wrong even when it parses.
- The API is stateless, so turn 2 sends the whole conversation again, including the assistant message that asked for the call.
- The SDK hides how little happens here. Step 2 removes it.

**Verify.**

- [ ] The script prints all three lines.
- [ ] The final answer mentions 7 degrees and fog, which only the tool knows.

## Step 2: what goes over the wire

**Goal.** Show the two HTTP requests behind the SDK call, with nothing in between.

**Prompt.**

> Write the same function-calling round trip as two plain curl commands against OpenRouter's chat completions endpoint, with the full JSON body written out in each command. No bash functions or scripting beyond the bare minimum. Save each response with curl -o and pretty-print it with jq. Read the tool call id from the turn 1 response with jq into a variable and use it in the turn 2 body. Read the key with `source ../.env`.

**Run.**

Open `02-curl/function-call.sh` next to the terminal. The file is two `curl` commands with the JSON bodies written out, so participants read the request bodies directly. Around them are only a `source` line for the key, a `jq` call per response, and one `jq` line that copies the tool call id from turn 1 into the variable `TOOL_CALL_ID`. In a terminal in this folder, paste the commands one at a time. The responses land in `02-curl/turn-1.json` and `02-curl/turn-2.json`, which git ignores. Alternatively, run all of them in one go:

```bash
npm run 02:curl
```

Turn 1 answers with a tool call. Keep the fields below on the screen for a moment.

```json
"finish_reason": "tool_calls",
"message": {
  "role": "assistant",
  "content": null,
  "tool_calls": [{
    "id": "fc_b5c0be18-3155-491f-82f2-565a3a887ae7",
    "type": "function",
    "function": {
      "name": "get_weather",
      "arguments": "{\"city\":\"Linz\"}"
    }
  }]
}
```

**Teaching points.**

- `finish_reason` is `tool_calls`, and `content` is `null`. That pair tells your agent loop to keep going.
- `tool_call_id` in turn 2 links the result to the request. It matters as soon as a model asks for several calls at once.
- Turn 2 is written by hand except for the id. The server keeps no state between the two requests, so the history is whatever the client sends.
- The turn 2 body follows `<<EOF` instead of sitting in single quotes, because the shell has to fill in `$TOOL_CALL_ID`. Point that out once and move on, since it's shell syntax, not HTTP.
- The response also carries a `reasoning` field, where the model explains to itself why it wants the tool. Step 5 shows where that text comes from.
- Don't add `-v` to the `curl` commands during the live demo, because it prints the `Authorization` header on the projector.

**Verify.**

- [ ] Turn 1 ends with `finish_reason` set to `tool_calls`.
- [ ] `echo $TOOL_CALL_ID` prints the same id as `tool_calls[0].id` in the turn 1 response.
- [ ] The turn 2 request contains the assistant message and the `tool` message.
- [ ] Turn 2 ends with `finish_reason` set to `stop`, and its `content` mentions 7 degrees and fog.

## Step 3: OpenAI and Anthropic side by side

**Goal.** Put the two common API formats next to each other. OpenRouter's debug option echoes the body it sends upstream, so one OpenAI-style request shows both the OpenAI and the Anthropic Messages form of the same tool.

**Prompt.**

> Write a TypeScript script that sends one function-calling request to two OpenRouter models, openai/gpt-oss-20b and anthropic/claude-haiku-5.5, with debug.echo_upstream_body enabled, and prints the upstream request body for each. Check the OpenRouter docs for how the debug option works.

**Run.**

```bash
npm run 03:debug
```

**Teaching points.**

- The debug option only works with `stream: true`. The upstream body arrives in a chunk with an empty `choices` array and a `debug` property.
- One tool definition goes in, and two different bodies come out.

| API format | JSON schema of the tool | System prompt |
|---|---|---|
| OpenAI Chat Completions | `tools[].function.parameters` | `messages[0]` |
| Anthropic Messages | `tools[].input_schema` | `system[]` |

- Both formats carry the same content for a tool: a name, a description, and a JSON schema. The difference is only where those fields sit.
- Both bodies are still JSON. A model can't read JSON requests, so something behind the API has to turn this into one string. Step 4 does that conversion by hand.

OpenRouter documents the debug option for development only, so keep it out of production code.

**Verify.**

- [ ] The output has one section per model.
- [ ] The Anthropic section contains `input_schema`, and the gpt-oss section contains `function.parameters`.

## Step 4: the tool definition becomes prompt text

**Goal.** Render one tool definition for two open-weight models and compare the prompts. A chat template is a Jinja program that ships with a model and turns a message list into one string. The prompt format of gpt-oss is called Harmony, and Qwen 3.5 has a format of its own.

**Prompt.**

> Write a TypeScript script that downloads chat_template.jinja from the openai/gpt-oss-20b and Qwen/Qwen3.5-27B repositories on Hugging Face and renders both with @huggingface/jinja. Pass one get_weather tool with a required and an optional parameter. For each model, print the prompt for the first turn, and the prompt after a tool call and its result. Highlight the special tokens.

**Run.**

```bash
npm run 04:templates
```

This is the part of the gpt-oss turn 1 prompt that matters:

```
<|start|>developer<|message|># Instructions

You are a concise weather assistant.

# Tools

## functions

namespace functions {

// Get the current weather for a city.
type get_weather = (_: {
// City name, e.g. Linz
city: string,
unit?: "celsius" | "fahrenheit",
}) => any;

} // namespace functions<|end|><|start|>user<|message|>What is the weather in Linz?<|end|><|start|>assistant
```

In the gpt-oss turn 2 prompt, the tool call and its result are plain text too:

```
<|start|>assistant to=functions.get_weather<|channel|>commentary json<|message|>{"city": "Linz"}<|call|><|start|>functions.get_weather to=assistant<|channel|>commentary<|message|>"{\"temperature\":7,\"condition\":\"fog\"}"<|end|><|start|>assistant
```

Now scroll to the Qwen section. The input was identical, and the prompt looks nothing like Harmony. Qwen gets the tool as JSON, plus written instructions for the format it has to answer in:

```
<|im_start|>system
# Tools

You have access to the following functions:

<tools>
{"type": "function", "function": {"name": "get_weather", "description": "Get the current weather for a city.", ...}}
</tools>

If you choose to call a function ONLY reply in the following format with NO suffix:

<tool_call>
<function=example_function_name>
<parameter=example_parameter_1>
value_1
</parameter>
...
```

In the Qwen turn 2 prompt, the tool call is tagged text, and the result comes back inside a `user` message:

```
<tool_call>
<function=get_weather>
<parameter=city>
Linz
</parameter>
</function>
</tool_call><|im_end|>
<|im_start|>user
<tool_response>
{"temperature":7,"condition":"fog"}
</tool_response><|im_end|>
```

| | gpt-oss (Harmony) | Qwen 3.5 |
|---|---|---|
| Message boundaries | `<\|start\|>` and `<\|end\|>` | `<\|im_start\|>` and `<\|im_end\|>` |
| Tool definition | TypeScript type | JSON inside `<tools>` |
| Tool call | `to=functions.get_weather` | `<tool_call>` with `<function=get_weather>` |
| Arguments | JSON | One `<parameter=...>` tag per argument |
| Tool result | Own role, `functions.get_weather` | `<tool_response>` in a `user` message |

**Teaching points.**

- Nothing of the OpenAI JSON survives unchanged. For gpt-oss, the schema became a TypeScript type, `description` became a comment, a missing `required` became `?`, and `enum` became a union type. Every word in a tool description ends up in the prompt, which is why tool design gets its own part of this session.
- Tools aren't a special input channel. Qwen's prompt literally asks the model in English to follow a format. It's a set of instructions like any system prompt.
- The gpt-oss prompt ends with `<|start|>assistant`. The Qwen prompt ends with an open assistant turn too. The model's only job is to continue that text.
- The template adds text you never wrote: the "You are ChatGPT" line, a knowledge cutoff, and today's date.
- `<|channel|>` separates private reasoning (`analysis`) from tool traffic (`commentary`) and the answer (`final`). The `reasoning` field from step 2 comes from the `analysis` channel.
- The template also raises an error if a message contains `<|channel|>` tags. Text that looks like control tokens is an attack on exactly this layer.

**Try it live.** Add a parameter to the tool, or change its `description`, and run the script again. The gpt-oss type and the Qwen JSON both change with it.

**Verify.**

- [ ] The gpt-oss section shows `type get_weather`, with `unit?` as an optional union type.
- [ ] The Qwen section shows the tool as JSON inside `<tools>`.
- [ ] The Qwen turn 2 prompt has `<tool_response>` inside a `user` message.

## Step 5: the model's raw text

**Goal.** Run the whole function call as text with gpt-oss, then compare it with a recorded Qwen run. The demo sends the prompt from step 4 to the `/completions` endpoint, without `messages` or `tools`, and parses the tool call itself.

**Prompt.**

> Reuse the template renderer from step 4. For openai/gpt-oss-20b pinned to DeepInfra, send the rendered prompt to OpenRouter's /completions endpoint and print the raw text. Parse the tool call from that text, run the tool, render the second prompt, and print the final answer. Add qwen/qwen3.5-27b pinned to SiliconFlow with its own parser, behind a command-line argument.

**Run.**

```bash
npm run 05:raw
```

```
########## openai/gpt-oss-20b ##########

=== Turn 1: what the model writes ===

<|channel|>analysis<|message|>We need to call get_weather function with city "Linz".<|end|><|start|>assistant<|channel|>commentary to=functions.get_weather <|constrain|>json<|message|>{"city":"Linz"}

=== Parsed tool call: get_weather({"city":"Linz"}) ===
```

Now open [the recorded Qwen output](05-raw-completion/qwen-recorded-output.md) and put it next to the gpt-oss text. The question and the tool are the same, and this is what Qwen writes in turn 1:

```
<tool_call>
<function=get_weather>
<parameter=city>
Linz
</parameter>
</function>
</tool_call>
```

**Teaching points.**

- Those two texts are the function call as each model produces it. The `tool_calls` array from step 2 is what the API's parser builds from text like this, and both models end up as the same JSON.
- Open `05-raw-completion/main.ts` and show the `gptOss` and `qwen` objects. A model comes as a pair: a template that writes its prompt and a parser that reads its answer. Swap the parsers and neither model works. That's why a new open-weight model needs tool-calling support in every server that hosts it.
- Qwen's arguments aren't JSON. `city` is text, so that's fine here, but a numeric parameter would arrive as text too, and the parser needs the tool's schema to convert it.
- A production parser also has to survive malformed output, because the model wrote it. The regular expressions in the demo don't try.
- Look at the second turn. The tool result goes back into the prompt as text, and the model continues from there. That's the whole agent loop at this level.

The live demo pins DeepInfra because it returns the raw text. Other hosts parse the call first and return empty text, or remove the special tokens. If the gpt-oss output has no `<|channel|>` in it, change its `provider` field to `dekallm`. Qwen comes from a recording because its host sometimes returns an empty second turn. `npm run 05:raw:qwen` runs Qwen if you want to try it anyway.

**Verify.**

- [ ] Turn 1 prints `to=functions.get_weather` with the special tokens around it.
- [ ] The script prints a final answer with 7 degrees and fog.
- [ ] The recorded Qwen output shows a `<tool_call>` block with `<parameter=city>`.

## What participants have now

Participants have followed one function call from the OpenAI or Anthropic JSON down to the text the model writes. The tool descriptions they write next land in the TypeScript block from step 4, and that's the place to pick up the next part of the session.
