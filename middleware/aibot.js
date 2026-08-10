const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function understandQuery(userMessage) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",

    messages: [
      {
        role: "system",
        content: `
You are an intent classifier for a visitor management system.

Return ONLY valid JSON.

Allowed intents:
- visitor_count
- visitor_comparison

Allowed periods:
- today
- yesterday
- this_week
- last_week
- this_month
- last_month
- last_7_days

Example:
{
  "intent": "visitor_count",
  "period": "yesterday"
}
        `,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],

    temperature: 0,
  });

  const text = completion.choices[0].message.content;

  return JSON.parse(text);
}

module.exports = {
  understandQuery,
};