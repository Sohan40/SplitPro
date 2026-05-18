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
  if (process.env.SPLITPRO_MOCK_OPENAI === "true") {
    return {
      outputText: JSON.stringify({
        title: "Mock AI spend insight",
        aiSummary: "This emulator response confirms the AI backend gate, sanitized summary, and output validation path. It is structured like the production AI dashboard.",
        groupHealth: {
          score: 80,
          label: "Good",
          explanation: "This is a SplitPro app insight based on group expense patterns, not financial advice.",
          tips: [
            "Keep categories clean so the dashboard stays useful.",
            "Settle balances regularly so the group stays simple.",
          ],
        },
        keyInsights: {
          category: "The request used the backend-only AI function path.",
          concentration: "The emulator mock confirms output validation without calling OpenAI.",
          memberPayment: "Member payment patterns are returned in a structured field.",
        },
        settlementSuggestions: [
          "Review current balances before recording a settlement.",
        ],
        budgetSuggestions: [
          "Consider using calculated totals as a suggested reference for any budget target.",
        ],
        warnings: ["Use real OpenAI only outside this emulator test flag."],
      }),
      model: "emulator-mock",
      usage: {
        input_tokens: Math.min(String(prompt || "").length, 1000),
        output_tokens: 64,
        request_id: requestId,
      },
    };
  }

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
      max_output_tokens: 900,
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
