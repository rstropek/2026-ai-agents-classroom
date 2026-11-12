# One complete function-calling round trip with two plain HTTP requests.
#
# Run the commands from the session-1-function-calling-fundamentals folder,
# either one at a time in a terminal or all at once with npm run 02:curl.
# -s hides curl's progress bar, and -o saves the response body to a file.
# jq pretty-prints that file and reads single values from it.
#
# OpenAI instead of OpenRouter: in both commands, use the URL
# https://api.openai.com/v1/chat/completions, the model gpt-5.4-mini,
# and $OPENAI_API_KEY as the key.


# Read OPENROUTER_API_KEY from the .env file in the repository root.

source ../.env


# Turn 1: the question and the tool definition.
# The model answers with a tool call instead of text.

curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -o 02-curl/turn-1.json \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [
      { "role": "system", "content": "Answer in one friendly sentence." },
      { "role": "user", "content": "What is the weather in Linz?" }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get the current weather for a city.",
          "parameters": {
            "type": "object",
            "properties": {
              "city": { "type": "string", "description": "City name" }
            },
            "required": ["city"]
          }
        }
      }
    ]
  }'

jq . 02-curl/turn-1.json


# Read the id of the tool call from the turn 1 response.

TOOL_CALL_ID=$(jq -r '.choices[0].message.tool_calls[0].id' 02-curl/turn-1.json)

echo $TOOL_CALL_ID


# Turn 2: the full history again, plus the assistant's tool call and our tool result.
# The server remembers nothing from turn 1, so we send every message once more.
# tool_call_id links our result to the tool call the model asked for.
#
# This body comes after <<EOF instead of in single quotes, so the shell
# fills in $TOOL_CALL_ID. -d @- tells curl to read the body from there.

curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -o 02-curl/turn-2.json \
  -d @- <<EOF
{
  "model": "openai/gpt-oss-20b",
  "messages": [
    { "role": "system", "content": "Answer in one friendly sentence." },
    { "role": "user", "content": "What is the weather in Linz?" },
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [
        {
          "id": "$TOOL_CALL_ID",
          "type": "function",
          "function": { "name": "get_weather", "arguments": "{\"city\":\"Linz\"}" }
        }
      ]
    },
    {
      "role": "tool",
      "tool_call_id": "$TOOL_CALL_ID",
      "content": "{\"city\":\"Linz\",\"temperature\":7,\"condition\":\"fog\"}"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get the current weather for a city.",
        "parameters": {
          "type": "object",
          "properties": {
            "city": { "type": "string", "description": "City name" }
          },
          "required": ["city"]
        }
      }
    }
  ]
}
EOF

jq . 02-curl/turn-2.json
