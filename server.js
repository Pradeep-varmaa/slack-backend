const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const pool = require('./lib/db');
const portfoliocount = require('./functions/portfoliocount')
const { understandQuery } = require('./functions/aibot');
const { WebClient } = require('@slack/web-api');
const GenerateAiAnswers = require('./functions/generateaianswers');
const ExtractRemainderdetails = require('./functions/remainderbot');
const { GetRemaindersData, InsertRemainderdata, UpdateRemainderstatus } = require('./functions/remainderdbfunctions');
const { sendEmail } = require('./lib/sentmail')
const { PortfolioCount } = require('./functions/portfoliocount');
const { FrameHumanAnswer } = require('./functions/frameanswer')
const { waitUntil } = require('@vercel/functions');

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const processedEvents = new Set();

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
  res.send("Welcome to the Slack Backend Server!");
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

      console.log("Received Slack event:", req.body.event);

      const { event, event_id } = req.body;
      if (processedEvents.has(event_id)) {
        console.log("Duplicate event ignored:", event_id);
        return res.sendStatus(200);
      }

      processedEvents.add(event_id);

      if (event.type !== "message" || event.bot_id) {
        return res.sendStatus(200);
      }

      res.sendStatus(200);

      try {

        const userMessage = event.text;
        const channelId = event.channel;

        const aianswer = await GenerateAiAnswers(userMessage);

        await slack.chat.postMessage({
          channel: channelId,
          text: aianswer,
        });

      } catch (error) {
        console.error("Error processing Slack message:", error);
      }

      return;
    }
  } catch (err) {
    console.error("Error processing Slack event:", err);
  }
});




async function postToSlack(responseUrl, text) {
  try {
    const r = await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_type: 'in_channel', text }),
    });
    console.log('Slack response_url reply:', r.status, await r.text());
  } catch (err) {
    console.error('postToSlack error:', err);
  }
}

async function handlePortfolio(userMessage, responseUrl) {
  try {
    const result = await understandQuery(userMessage);
    console.log('2. understood:', result);

    const rows = await PortfolioCount(result.sql);
    console.log('3. rows:', rows);

    const answer = await FrameHumanAnswer(userMessage, rows);
    console.log('4. answer:', answer);

    await postToSlack(responseUrl, answer);
    console.log('5. posted');
  } catch (error) {
    console.error('Error:', error);
    await postToSlack(responseUrl, 'Sorry, something went wrong. Please try again.');
  }
}


app.post("/slack/commands", async (req, res) => {
  if (req.body.command === '/assisstant') {
    res.status(200).send(`Hello! This is Jimmy. How can I assist you with you ?`);
  }

  // if (req.body.command === '/portfolio') {
  //   const userMessage = req.body.text;
  //   try {
  //     const result = await understandQuery(userMessage);
  //     console.log("AI understanding result:", result.sql);

  //     const querydata = await PortfolioCount(result.sql);

  //     console.log("rows:", querydata);

  //     const answer = await FrameHumanAnswer(userMessage, querydata);

  //     console.log("Framed human answer:", answer);

  //     res.status(200).json(result);
  //   }
  //   catch (error) {
  //     console.error("Error understanding query:", error);
  //     res.status(500).send("Error processing your request.");
  //   }
  // }

  if (req.body.command === '/portfolio') {
  // Start the slow work, but do NOT await it here
  waitUntil(handlePortfolio(req.body.text, req.body.response_url));

  console.log('1. ack sent');
  return res.status(200).send(); // must be the first thing that completes
}

  if (req.body.command === '/websearch') {
    const userMessage = req.body.text;

    const aianswer = await GenerateAiAnswers(userMessage);
    res.status(200).send(aianswer);
  }
  if (req.body.command === '/remainder') {
    const userMessage = req.body.text;
    const result = await ExtractRemainderdetails(userMessage);
    const jsondata = JSON.parse(result);
    console.log("Remainder extraction result:", typeof jsondata);

    const insertResult = await InsertRemainderdata(task = jsondata.reminder_message, sent = jsondata.reminder_time);

    const converted_time = new Date(jsondata.reminder_time).toLocaleString('en-US', { timeZone: 'UTC' }, { hour12: true, hour: 'numeric', minute: 'numeric', day: 'numeric' });
    if (insertResult) {
      res.status(200).send(`Remainder was initiated successfully on ${converted_time}`);
    }
    else {
      res.status(500).send(`Something went wrong! Try again later.`);
    }
  }
})

app.get("/slack/checkremainders", async (req, res) => {
  const remainder = await GetRemaindersData();

  let mail_sent = 0

  for (const data of remainder) {
    try {
      const mail = await sendEmail(data.task, data.sent_at);

      if (mail) {
        mail_sent++

        const update = await UpdateRemainderstatus(data.id, "SENT")
      }

    } catch (err) {
      console.error("Error while sending email for remainder id:", data.id, err);
    }
  }
  res.status(200).send(`Remainders checked. Emails sent: ${mail_sent}`);
})


app.listen(process.env.PORT_NO, () => {
  console.log(`Server is running on port ${process.env.PORT_NO}`);
})
