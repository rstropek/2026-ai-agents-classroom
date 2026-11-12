# Session 1 storybook: function calling fundamentals

**Classroom: Moderne KI-Agents entwickeln, session 1, first part**

This storybook walks you through the finished sample code for the opening of session 1. You don't write the samples yourself. You run them, read them, and stop them in the debugger at the places where something interesting happens. Each step has a **Goal**, the command to **Run**, a **Walkthrough** of the code, the breakpoints to set under **Debug**, and a **Verify** checklist. Some steps add a **Try it** experiment. The code sits in one numbered folder per step, next to this file.

## The idea of this part

You already call models with tools. The path between your JSON and the model usually stays hidden, so this part follows one request along that path. Take this sentence with you: a function call is text that the model writes and a parser recognizes.

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

The API formats differ at the top. Below the API layer, the model works on one string, and template and parser belong to the specific model. The samples use two open-weight models for that lower half, gpt-oss and Qwen 3.5, because their templates are public. Closed models such as Claude don't publish theirs, so you can only look inside on an open-weight model.

All five steps use the same question ("What is the weather in Linz?") and the same `get_weather` tool. Only the layer changes, so you can compare the outputs directly. The tool returns fixed fog data, because the weather isn't the lesson.

## Step 0: prerequisites

You need Node.js 24 or newer, `curl`, `jq`, and Visual Studio Code. Node 24 runs TypeScript files directly, so none of the samples has a build step.

Create `.env` in the repository root with your key:

```
OPENROUTER_API_KEY=...
```

Then install the packages in this folder:

```bash
npm install
```

A full run of all five steps costs well below one cent on OpenRouter.

**OpenAI instead of OpenRouter.** Steps 1 and 2 only use the standard Chat Completions API, and both work with an OpenAI key. Step 1 contains a commented-out OpenAI block with `gpt-5.4-mini` and `OPENAI_API_KEY`, which you swap for the OpenRouter block. The header comment of the step 2 file says which URL, model, and key to change. Step 4 needs no key at all. Steps 3 and 5 depend on OpenRouter, so without an OpenRouter key you follow them on the trainer's screen.

## Debugging the samples

Open the repository root as the folder in Visual Studio Code, because the launch configuration in `.vscode/launch.json` reads `.env` from there. Then start a sample like this:

1. Open the sample file, for example `01-sdk/main.ts`.
2. Set the breakpoints for the step. Every place worth stopping at carries a marker comment such as `// Breakpoint 1.1: the raw turn 1 response.` Click in the gutter next to the first code line below the marker. A search for `Breakpoint 1.` finds all markers of step 1.
3. Open the Run and Debug view, pick **Debug current sample file**, and press F5.

**Debug current sample file with argument** does the same, but asks for one command-line argument first. Step 5 uses it.

While the debugger is paused, four panes do the work:

- **Variables** shows everything in scope. You can also double-click a value and change it, and the program continues with your value.
- **Watch** keeps an expression on screen while you step, for example `messages.length`.
- **Debug Console** evaluates any expression in the paused scope, including calls to functions from the sample. `JSON.stringify(messages, null, 2)` prints a long object in a readable form.
- **Call Stack** shows who called the current function. Once frameworks enter the picture later in the session, this is where you see their loop.

If a request fails, turn on **Caught Exceptions** in the Breakpoints pane and run again. The debugger then stops where the SDK throws the error, and you can expand the error object instead of reading a stack trace. **Uncaught Exceptions** isn't enough in these samples, because the error leaves through a top-level `await`, and the debugger may not count that as uncaught.

## Step 1: the developer's view

**Goal.** Run a complete function call with the OpenAI SDK, in the form you know from your own projects.

**Run.**

```bash
npm run 01:sdk
```

```
Model asks for: get_weather({"city":"Linz"})
Our code returns: {"city":"Linz","temperature":7,"condition":"fog"}
Final answer: In Linz the current weather is a cool 7 °C with fog.
```

**Walkthrough.** Open `01-sdk/main.ts` and read it from top to bottom. It's about 60 lines and has no helpers.

- `tools` is one JSON schema with a name and a description. That's everything the model ever learns about `getWeather`.
- Turn 1 sends the question and the tool. The answer contains a request for a call, not a result. The model can't run anything, so `getWeather` runs in your process. Every security question later in this course follows from that split.
- `arguments` arrives as a JSON string, and the model wrote that string. `JSON.parse` can fail, and the content can be wrong even when it parses.
- Turn 2 sends the whole conversation again, including the assistant message that asked for the call. The API is stateless.
- The SDK hides how little happens here. Step 2 removes it.

**Debug.** Set breakpoints 1.1 to 1.3 and start the debugger with `01-sdk/main.ts` open.

- **Breakpoint 1.1, the raw turn 1 response.** Expand `first.choices[0]` in Variables. `finish_reason` is `tool_calls`, `message.content` is `null`, and `message.tool_calls[0].function.arguments` is a string with quotes inside, not an object. Expand `first.usage` too: the tool definition costs input tokens on every request.
- **Breakpoint 1.2, your code runs the tool.** Look at the Call Stack. It holds your file and nothing from the SDK, because your code called `getWeather` directly. The HTTP request of turn 1 has finished by now, and the server keeps no connection open for you. You could stay paused for an hour and turn 2 would still work.
- **Breakpoint 1.3, the history for turn 2.** Run `JSON.stringify(messages, null, 2)` in the Debug Console. You see four messages: system, user, the assistant message with `tool_calls`, and the `tool` message whose `tool_call_id` matches the call's `id`.

**Try it.** Stop at breakpoint 1.3 again, expand `messages[3]` in Variables, and double-click its `content`. Type the new value as a JavaScript string literal, quotes included, so the temperature reads `35` instead of `7`: `'{"city":"Linz","temperature":35,"condition":"fog"}'`. Continue. The final answer reports 35 degrees, because the model knows only what your code sends.

**Verify.**

- [ ] The script prints all three lines.
- [ ] The final answer mentions 7 degrees and fog, which only the tool knows.

## Step 2: what goes over the wire

**Goal.** See the two HTTP requests behind the SDK call, with nothing in between.

**Run.** Open `02-curl/function-call.sh` next to a terminal in this folder, and paste the commands one at a time. The responses land in `02-curl/turn-1.json` and `02-curl/turn-2.json`, which git ignores. Alternatively, run all of them in one go:

```bash
npm run 02:curl
```

Turn 1 answers with a tool call:

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

**Walkthrough.** The file is two `curl` commands with the JSON bodies written out, so you read the request bodies directly. Around them are only a `source` line for the key, a `jq` call per response, and one `jq` line that copies the tool call id from turn 1 into the variable `TOOL_CALL_ID`.

- `finish_reason` is `tool_calls`, and `content` is `null`. That pair tells your agent loop to keep going.
- The format of the tool call id depends on the provider that OpenRouter picked, so yours may start with `chatcmpl-tool-` or `call_` instead of `fc_`.
- `tool_call_id` in turn 2 links the result to the request. It matters as soon as a model asks for several calls at once, which step 6 shows.
- Turn 2 is written by hand except for the id. The server keeps no state between the two requests, so the history is whatever the client sends.
- The turn 2 body follows `<<EOF` instead of sitting in single quotes, because the shell has to fill in `$TOOL_CALL_ID`. That's shell syntax, not HTTP.
- The response also carries a `reasoning` field, where the model explains to itself why it wants the tool. Step 5 shows where that text comes from.

**Debug.** There's no debugger for a shell script, and you don't need one. Pasting the commands one at a time is the step-by-step mode, and `jq . 02-curl/turn-1.json` is your Variables pane. Don't add `-v` to the `curl` commands while you share your screen, because it prints the `Authorization` header.

**Try it.** Change the tool result in the turn 2 body to a different temperature and send turn 2 again. Same effect as the edit in step 1, now without any SDK.

**Verify.**

- [ ] Turn 1 ends with `finish_reason` set to `tool_calls`.
- [ ] `echo $TOOL_CALL_ID` prints the same id as `tool_calls[0].id` in the turn 1 response.
- [ ] The turn 2 request contains the assistant message and the `tool` message.
- [ ] Turn 2 ends with `finish_reason` set to `stop`, and its `content` mentions 7 degrees and fog.

## Step 3: OpenAI and Anthropic side by side

**Goal.** Put the two common API formats next to each other. OpenRouter's debug option echoes the body it sends upstream, so one OpenAI-style request shows both the OpenAI and the Anthropic Messages form of the same tool.

**Run.**

```bash
npm run 03:debug
```

The output has one section per model, with a header such as `===== openai/gpt-oss-20b, served by Groq =====` followed by the JSON body OpenRouter sent to that provider. The provider can change between runs, and so can the details of the body.

**Walkthrough.** Open `03-openrouter-debug/main.ts`. It sends one plain `fetch` per model, with the OpenAI tool format, to `openai/gpt-oss-20b` and `anthropic/claude-haiku-5.5`.

- `debug: { echo_upstream_body: true }` only works with `stream: true`. That's why the script splits the response into `data:` lines.
- The upstream body arrives in a chunk with an empty `choices` array and a `debug` property.
- OpenRouter documents the debug option for development only, so keep it out of production code.

**Debug.** Set breakpoint 3.1. The loop runs once per model, so the debugger stops twice.

- **Breakpoint 3.1, the stream chunks and the upstream body.** Expand `chunks` first. Each entry is one server-sent event, and most of them carry a small piece of reasoning or of the tool call's arguments in `choices[0].delta`. Then expand `debugChunk.debug.echo_upstream_body`. On the first stop, for gpt-oss, the tool sits in `tools[0].function.parameters` and the system prompt is `messages[0]`. Press F5 to continue to the second stop, for Claude. Now the tool sits in `tools[0].input_schema`, and the system prompt has moved to a top-level `system` array.

| API format | JSON schema of the tool | System prompt |
|---|---|---|
| OpenAI Chat Completions | `tools[].function.parameters` | `messages[0]` |
| Anthropic Messages | `tools[].input_schema` | `system[]` |

Both formats carry the same content for a tool: a name, a description, and a JSON schema. The difference is only where those fields sit. Both bodies are still JSON, though, and a model can't read JSON requests. Something behind the API has to turn this into one string, and step 4 does that conversion by hand.

**Verify.**

- [ ] The output has one section per model.
- [ ] The Anthropic section contains `input_schema`, and the gpt-oss section contains `function.parameters`.

## Step 4: the tool definition becomes prompt text

**Goal.** Render one tool definition for two open-weight models and compare the prompts. A chat template is a Jinja program that ships with a model and turns a message list into one string. The prompt format of gpt-oss is called Harmony, and Qwen 3.5 has a format of its own.

**Run.** This step needs no API key.

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

Now scroll to the `qwen` section. The input was identical, and the prompt looks nothing like Harmony. Qwen gets the tool as JSON, plus written instructions for the format it has to answer in:

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

**Walkthrough.** Open `04-chat-templates/render.ts` first. It downloads `chat_template.jinja` from Hugging Face and renders it with `@huggingface/jinja`, which is the same job an inference server does for every request. Then open `04-chat-templates/main.ts`.

- `tools` is the same OpenAI tool definition as before, with one extra optional `unit` parameter.
- `roundTrip` passes `arguments` as an object, not as the JSON string from the wire. These templates encode it themselves, and a string would end up encoded twice. The tool result, on the other hand, goes in as a string and still gets encoded a second time: the turn 2 excerpt shows it as `"{\"temperature\":7,...}"`. The model copes with that, and in step 5 it even comments on it.
- Nothing of the OpenAI JSON survives unchanged. For gpt-oss, the schema became a TypeScript type, `description` became a comment, a missing `required` became `?`, and `enum` became a union type. Every word in a tool description ends up in the prompt, which is why tool design gets its own part of this session.
- Tools aren't a special input channel. Qwen's prompt literally asks the model in English to follow a format, like any system prompt.
- The gpt-oss prompt ends with `<|start|>assistant`, and the Qwen prompt ends with an open assistant turn too. The model's only job is to continue that text.
- The template adds text you never wrote: the "You are ChatGPT" line, a knowledge cutoff, and today's date.
- `<|channel|>` separates private reasoning (`analysis`) from tool traffic (`commentary`) and the answer (`final`). The `reasoning` field from step 2 comes from the `analysis` channel.
- The gpt-oss template raises an error if an assistant message contains `<|channel|>analysis<|message|>` or `<|channel|>final<|message|>`. User messages pass through unchecked, so a user can type text that looks like control tokens. That's an attack on exactly this layer, and the inference server has to handle it, not the template.

**Debug.** Set breakpoint 4.1 in `main.ts`. The debugger stops once per model, with the downloaded template in `template`.

- **Breakpoint 4.1, the Jinja source.** Run `console.log(template)` in the Debug Console and search the output for `render_tool_namespace` on the gpt-oss stop, or for `<tools>` on the Qwen stop. That's the code that writes your tool into the prompt. The gpt-oss template builds the text `namespace functions` at run time from `"namespace " + namespace_name`, which is why a search for the finished text finds nothing.

The Debug Console can call `renderPrompt` too, so you can re-render without restarting:

```js
console.log(renderPrompt(template, question, []))
```

Without tools, the whole `# Tools` block disappears. Try `renderPrompt(template, question, tools)` next, and compare.

**Try it.** Add a parameter to the tool in `main.ts`, or change its `description`, and run the script again. The gpt-oss type and the Qwen JSON both change with it.

**Verify.**

- [ ] The `gptOss` section shows `type get_weather`, with `unit?` as an optional union type.
- [ ] The `qwen` section shows the tool as JSON inside `<tools>`.
- [ ] The Qwen turn 2 prompt has `<tool_response>` inside a `user` message.

## Step 5: the model's raw text

**Goal.** Run the whole function call as text with gpt-oss, then compare it with a recorded Qwen run. The sample sends the prompt from step 4 to the `/completions` endpoint, without `messages` or `tools`, and parses the tool call itself.

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

**Walkthrough.** Open `05-raw-completion/main.ts`.

- The `gptOss` and `qwen` objects are the heart of the file. A model comes as a pair: a template that writes its prompt and a parser that reads its answer. Swap the parsers and neither model works. That's why a new open-weight model needs tool-calling support in every server that hosts it.
- `complete` sends a single `prompt` string to `/completions`. There's no `tools` and no `messages`, so OpenRouter has nothing to parse.
- The two texts are the function call as each model produces it. The `tool_calls` array from step 2 is what the API's parser builds from text like this, and both models end up as the same JSON.
- Qwen's arguments aren't JSON. `city` is text, so that's fine here, but a numeric parameter would arrive as text too, and the parser needs the tool's schema to convert it.
- A production parser also has to survive malformed output, because the model wrote it. The regular expressions in this sample don't try.
- In turn 2, the tool result goes back into the prompt as text, and the model continues from there. That's the whole agent loop at this level.

The sample pins DeepInfra because it returns the raw text. Other hosts parse the call first and return empty text, or remove the special tokens. If the gpt-oss output has no `<|channel|>` in it, change its `provider` field to `dekallm`. Qwen comes from a recording because its host sometimes returns an empty second turn. `npm run 05:raw:qwen` runs Qwen if you want to try it anyway, and so does **Debug current sample file with argument** with the argument `qwen`.

**Debug.** Set breakpoints 5.1 to 5.3. The request uses `temperature: 0`, so your run should match the output above closely.

- **Breakpoint 5.1, the raw text.** Hover over `first`. This string is the model's entire output, special tokens included. Find `to=functions.get_weather` in it. Then give the text to both parsers in the Debug Console:

  ```js
  gptOss.parseToolCall(first)
  qwen.parseToolCall(first)
  ```

  The first returns the call, the second returns `undefined`. The gpt-oss text has no `<function=` tag, so the Qwen parser finds no call at all.
- **Breakpoint 5.2, the parser's view.** Continue with F5. `call` is the result of the regular expression: `call[1]` is the function name, and `call[2]` is the JSON the model wrote. `JSON.parse` in this `return` is where a malformed answer would throw.
- **Breakpoint 5.3, the turn 2 prompt.** Run `console.log(renderPrompt(template, messages, tools))` in the Debug Console. The tool result from `getWeather` now sits in the prompt as plain text, right before the open assistant turn.

**Verify.**

- [ ] Turn 1 prints `to=functions.get_weather` with the special tokens around it.
- [ ] The script prints a final answer with 7 degrees and fog.
- [ ] The recorded Qwen output shows a `<tool_call>` block with `<parameter=city>`.

## What you have now

You have followed one function call from the OpenAI or Anthropic JSON down to the text the model writes, and stopped at every layer on the way. The tool descriptions you write from now on land in the TypeScript block from step 4, and that's where the next part of the session picks up.
