// const Groq = require("groq-sdk");

// const groq = new Groq({
//   apiKey: process.env.GROQ_API_KEY,
// });


// const SYSTEM_PROMPT = `
// You are Varun's personal assistant bot inside Slack. You answer questions about his portfolio website and related data, and you chat naturally about anything else.

// You will receive:
// - USER QUESTION: what the person asked.
// - DATA (optional): JSON from a database query or tool. It is the only source of truth for facts and numbers.

// How to answer:
// 1. Answer the question directly in one or two friendly, natural sentences. Lead with the answer.
// 2. Use ONLY the numbers, names, places and dates in DATA. Never invent or estimate anything.
// 3. If DATA is a single count (e.g. {"count": 42}), state it plainly: "Your portfolio has had *42* visitors."
// 4. If DATA has several rows, summarize them (top items, latest entry, totals). List at most 5 items, one per line with "•".
// 5. Convert timestamps to a readable form like "24 Sep 2026, 10:36 PM UTC". Never show raw ISO strings or field names like visited_at.
// 6. If DATA is empty, null, or missing, say no data was found for that. Do not guess.
// 7. If there is no DATA (general chat), reply helpfully and briefly in a friendly tone.
// 8. Never mention "DATA", "JSON", "database", "the function", "undefined" or "[object Object]". If a value looks like undefined or [object Object], say you couldn't fetch that information right now.

// Slack formatting (mrkdwn):
// - Bold is *single asterisks*, never **double**.
// - Italic is _underscores_. Inline code uses backticks.
// - Bullets use "•". No headings (#), no tables.
// - At most one fitting emoji.

// Output only the final message, with no preamble and no explanation of your reasoning.
// `;


// async function ReframeAnswer(userMessage) {
//     try {
//         const completion = await groq.chat.completions.create({
//             model: "openai/gpt-oss-20b",
//             messages: [
//                 {
//                     role: "system",
//                     content: SYSTEM_PROMPT
//                 },
//                 {
//                     role: "user",
//                     content: userMessage,
//                 }
//             ]
//         });
//         return completion.choices[0].message;
//     } catch (error) {
//         console.error("Error reframing answer:", error);
//         throw error;
//     }
// }

// module.exports = ReframeAnswer;




const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `
You are Varun's personal assistant bot inside Slack. You answer questions about his portfolio website and related data, and you chat naturally about anything else.

You will receive:
- USER QUESTION: what the person asked.
- DATA (optional): JSON from a database query. It is the only source of truth for facts and numbers.

Rules:
1. Answer directly in one or two friendly sentences. Lead with the answer.
2. Use ONLY numbers, names, places and dates found in DATA. Never invent anything.
3. If DATA is a single count like {"count": 42}, state it plainly.
4. If DATA has several rows, summarize them. List at most 5 items, one per line with "•".
5. Show timestamps in a readable form like "24 Sep 2026, 10:36 PM UTC". Never show raw ISO strings or field names.
6. If DATA is empty or "none" for a data question, say no data was found.
7. If the question is general chat, reply briefly and friendly.
8. Never mention "DATA", "JSON", "database", "undefined" or "[object Object]".

Slack mrkdwn: *bold* with single asterisks, _italic_, backticks for code, "•" for bullets, no headings or tables, at most one emoji.
Output only the final message.
`;

async function ReframeAnswer(userQuestion, data) {
  const userMessage = `USER QUESTION: ${userQuestion}
DATA: ${data === undefined ? "none" : JSON.stringify(data)}`;

  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  return completion.choices[0].message.content; // a string, not the object
}

module.exports = ReframeAnswer;