const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function GenerateAiAnswers(userMessage) {
    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            temperature: 0.2,

            messages: [
                {
                    role: "system",
                    content: `
You are an AI assistant for a visitor management system.

Answer the user's questions clearly and concisely.
`
                },
                {
                    role: "user",
                    content: userMessage
                }
            ]
        });

        return completion.choices[0].message.content;

    } catch (err) {
        console.error("Error generating AI answer:", err);
        throw err;
    }
}

module.exports = GenerateAiAnswers;