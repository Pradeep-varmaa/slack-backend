const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function understandQuery(userMessage) {
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",

    messages: [
        systemPrompt,
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