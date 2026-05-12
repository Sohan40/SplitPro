const { SYSTEM_PROMPT } = require("./prompts");

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4o-mini";

function getOutputText(responseJson) {
  if (typeof responseJson.output_text === "string") {
    return responseJson.output_text;
  }

  const chunks = [];
  (responseJson.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      if (typeof content.text === "string") {
        chunks.push(content.text);
      }
    });
  });

  return chunks.join("\n").trim();
}

async function callOpenAi({ apiKey, prompt, requestId }) {
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured.");
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Client-Request-Id": requestId,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_output_tokens: 500,
      temperature: 0.2,
      text: {
        format: {
          type: "json_object",
        },
      },
    }),
  });

  const responseJson = await response.json().catch(() => ({}));

  if (!response.ok) {
    const code = responseJson.error?.code || response.status;
    throw new Error(`OpenAI request failed: ${code}`);
  }

  const outputText = getOutputText(responseJson);
  if (!outputText) {
    throw new Error("OpenAI returned empty output.");
  }

  return {
    outputText,
    model: responseJson.model || process.env.OPENAI_MODEL || DEFAULT_MODEL,
    usage: responseJson.usage || null,
  };
}

module.exports = {
  callOpenAi,
};
