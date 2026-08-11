const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const pool = require('./lib/db');
const portfoliocount = require('./middleware/portfoliocount')
const { understandQuery } = require('./middleware/aibot');
const { WebClient } = require('@slack/web-api');
const GenerateAiAnswers = require('./middleware/generateaianswers');

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

  try {

    // Slack retry detection
    const retryNum = req.headers["x-slack-retry-num"];

    if (retryNum) {

      console.log(
        "Ignoring Slack retry:",
        retryNum,
        req.headers["x-slack-retry-reason"]
      );

      return res.sendStatus(200);
    }

    const { type, event } = req.body;

    if (type === "url_verification") {
      return res.status(200).send(req.body.challenge);
    }

    if (type !== "event_callback") {
      return res.sendStatus(200);
    }

    if (!event) {
      return res.sendStatus(200);
    }

    if (event.type !== "message") {
      return res.sendStatus(200);
    }

    if (event.bot_id) {
      return res.sendStatus(200);
    }

    res.sendStatus(200);

    const userMessage = event.text;
    const channelId = event.channel;

    console.log("User:", userMessage);

    try {

      const aianswer =
        await GenerateAiAnswers(userMessage);

      console.log("AI:", aianswer);

      await slack.chat.postMessage({
        channel: channelId,
        text: aianswer
      });

    } catch (error) {

      console.error(
        "AI/Slack error:",
        error
      );
    }

  } catch (error) {

    console.error("Slack event error:", error);

    // Don't attempt another response if already sent
  }
});


app.post("/slack/commands", async (req, res) => {
  console.log("Slack command request body:", req.body);
  if (req.body.command === '/assisstant') {
    res.status(200).send(`Hello! This is Jimmy. How can I assist you with you ?`);
  }

  if (req.body.command === '/bot') {
    const userMessage = req.body.text;
    try {
      const result = await understandQuery(userMessage);
      console.log("Intent classification result:", result);
      res.status(200).send(`Intent: ${result.intent}, Period: ${result.period}`);
    } catch (error) {
      console.error("Error understanding query:", error);
      res.status(500).send("Error processing your request.");
    }
  }

  if (req.body.command === '/search') {
    const userMessage = req.body.text;

    const aianswer = await GenerateAiAnswers(userMessage);
    res.status(200).send(aianswer);
  }

})



app.listen(process.env.PORT_NO, () => {
  console.log(`Server is running on port ${process.env.PORT_NO}`);
})
