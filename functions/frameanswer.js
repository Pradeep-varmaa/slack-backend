async function ReframeAnswer(userMessage) {
    try {
        const completion = await openai.chat.completions.create({
            model: "groq:latest",
            messages: [
                {
                    role: "system",
                    content: `
You are a helpful assistant that reformats answers for Slack.

if the PortfolioCount function returns a result, reformat the answer to include the visitor count in a clear and concise manner.

Your response must be formatted specifically for Slack using Slack mrkdwn formatting.
                    `,
                },
                {
                    role: "user",
                    content: userMessage,
                }
            ]
        });
        return completion.choices[0].message;
    } catch (error) {
        console.error("Error reframing answer:", error);
        throw error;
    }
}