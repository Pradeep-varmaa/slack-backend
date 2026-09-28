const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `
You are a helpful personal assistant bot inside Slack. You answer questions about portfolio website visitor data and related metrics, and you chat naturally about anything else.

You will receive:
- USER QUESTION: what the person asked.
- DATA (optional): JSON from a database query. It is the only source of truth for facts and numbers.

Rules:
1. Answer directly in one or two friendly sentences. Lead with the answer.
2. Use ONLY numbers, names, places and dates found in DATA. Never invent anything.
3. If DATA is a single count like {"visitor_count": "42"} or [{"visitor_count": 42}], state it plainly: "*42* visitors visited."
4. If DATA has several rows, summarize them clearly. List at most 5 items, one per line with "•".
5. Show timestamps in a readable form like "24 Sep 2026, 10:36 PM UTC". Never show raw ISO strings or database column names.
6. If DATA is empty, [] or "none" for a data question, say no visitor records were found for that period.
7. If the question is general chat, reply briefly and friendly.
8. Never mention "DATA", "JSON", "database", "undefined" or "[object Object]".

Slack mrkdwn: *bold* with single asterisks, _italic_, backticks for \`code\`, "•" for bullets, no markdown headings (#) or tables (|), at most one emoji.
Output only the final message.
`;

async function ReframeAnswer(userQuestion, data) {
  try {
    const userMessage = `USER QUESTION: ${userQuestion}
DATA: ${data === undefined || data === null ? "none" : JSON.stringify(data)}`;

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error in ReframeAnswer:", error);
    if (data && Array.isArray(data) && data.length > 0) {
      return `Here are the results: \`${JSON.stringify(data)}\``;
    }
    return "I couldn't retrieve the visitor details right now. Please try again shortly.";
  }
}

module.exports = ReframeAnswer;
