const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const pool = require('./lib/db');
const portfoliocount = require('./middleware/portfoliocount')
const { understandQuery } = require('./middleware/aibot');
const { WebClient } = require('@slack/web-api');
const GenerateAiAnswers  = require('./middleware/generateaianswers');

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const app = express();

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

app.get("/", (req, res) => {
  res.send("Hello Varma! This is a slack server for testing slack events and commands.");
})


app.post("/slack/events", async (req, res) => {
  console.log("Slack request body:", req.body);

  try {
    const { type, challenge } = req.body || {};

    if (type === "url_verification") {
      return res.status(200).json({
        challenge: challenge,
      });
    }

    if (type === "event_callback") {
      const { event } = req.body;
      if (event.type !== "message" || event.bot_id) {
        return;
      }

      if (event.type === "message") {
        const userMessage = event.text;
        const channelId = event.channel;

        const aianswer = await GenerateAiAnswers(userMessage);

         const result = await slack.chat.postMessage({
          channel: channelId,
          text: aianswer,
         })
      }
    }
  } catch (err) {
    console.error("Error processing Slack event:", err);
  }
});


app.post("/slack/commands", (req, res) => {
  console.log("Slack command request body:", req.body);
  if (req.body.command === '/assisstant') {
    res.status(200).send(`Hello! This is Jimmy. How can I assist you with you ?`);
  }
  if (req.body.command === '/bot') {

    const userMessage = req.body.text;
    understandQuery(userMessage)
      .then((result) => {
        console.log("Intent classification result:", result);
        res.status(200).send(`Intent: ${result.intent}, Period: ${result.period}`);
      })
      .catch((error) => {
        console.error("Error understanding query:", error);
        res.status(500).send("Error processing your request.");
      })
  }

})


app.get('/portfoliocount', (req, res) => {
  const count = portfoliocount()

  res.send(count).status(200)

})

app.get('/generateaianswers', async (req, res) => {
  const userMessage = "What is the Python code to find the factorial of a number?";

  try {
    const aiAnswer = await GenerateAiAnswers(userMessage);
    res.status(200).json({ answer: aiAnswer });
  } catch (error) {
    console.error("Error generating AI answer:", error);
    res.status(500).json({ error: "Error generating AI answer." });
  }
});

app.listen(process.env.PORT_NO, () => {
  console.log(`Server is running on port ${process.env.PORT_NO}`);
})
