const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function GenerateAiAnswers(userMessage) {
    try {
        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-20b",
            temperature: 0.2,

            messages: [
                {
                    role: "system",
                    content: `

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


async function checkModels() {
    try {
        const models = await groq.models.list();

        console.log(
            models.data.map(model => ({
                id: model.id,
                active: model.active
            }))
        );

    } catch (error) {
        console.error("Unable to retrieve Groq models:", error);
    }
}

// checkModels(); 

module.exports = GenerateAiAnswers;