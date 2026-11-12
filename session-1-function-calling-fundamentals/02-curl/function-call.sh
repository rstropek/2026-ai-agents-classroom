#!/usr/bin/env bash
# One complete function-calling round trip, with every request and response printed.
set -euo pipefail

cd "$(dirname "$0")"
set -a
source ../../.env
set +a

# OpenRouter
URL=https://openrouter.ai/api/v1/chat/completions
MODEL=openai/gpt-oss-20b
API_KEY=$OPENROUTER_API_KEY

# OpenAI: comment out the three lines above and uncomment these three.
# URL=https://api.openai.com/v1/chat/completions
# MODEL=gpt-5.4-mini
# API_KEY=$OPENAI_API_KEY

TOOLS=$(cat <<'JSON'
[
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
JSON
)

MESSAGES='[
  { "role": "system", "content": "Answer in one friendly sentence." },
  { "role": "user", "content": "What is the weather in Linz?" }
]'

send() {
  local request
  request=$(jq -n --arg model "$MODEL" --argjson tools "$TOOLS" --argjson messages "$1" \
    '{ model: $model, messages: $messages, tools: $tools }')

  # Status output goes to stderr, because stdout carries the response for the caller.
  echo ">>> Request body" >&2
  jq . <<<"$request" >&2

  curl -sS "$URL" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$request"
}

echo "===== Turn 1: question and tool definition ====="
RESPONSE=$(send "$MESSAGES")
echo "<<< Response body"
jq . <<<"$RESPONSE"

ASSISTANT=$(jq '.choices[0].message' <<<"$RESPONSE")
TOOL_CALL_ID=$(jq -r '.tool_calls[0].id // empty' <<<"$ASSISTANT")
if [[ -z "$TOOL_CALL_ID" ]]; then
  echo "The model answered without a tool call. Run the script again." >&2
  exit 1
fi

echo
echo "The model only asked for a call. This script is the one that runs the tool:"
jq -r '.tool_calls[0].function | "\(.name)(\(.arguments))"' <<<"$ASSISTANT"

# A real tool would use the arguments. This one always reports fog.
RESULT='{"city":"Linz","temperature":7,"condition":"fog"}'

MESSAGES=$(jq -n --argjson first "$MESSAGES" --argjson assistant "$ASSISTANT" \
  --arg id "$TOOL_CALL_ID" --arg result "$RESULT" \
  '$first + [$assistant, { role: "tool", tool_call_id: $id, content: $result }]')

echo
echo "===== Turn 2: full history plus tool result ====="
RESPONSE=$(send "$MESSAGES")
echo "<<< Response body"
jq . <<<"$RESPONSE"

echo
echo "Final answer: $(jq -r '.choices[0].message.content' <<<"$RESPONSE")"
