// const express = require('express');
// const dotenv = require('dotenv');
// dotenv.config();
// const pool = require('./lib/db');
// const portfoliocount = require('./functions/portfoliocount')
// const { understandQuery } = require('./functions/aibot');
// const { WebClient } = require('@slack/web-api');
// const GenerateAiAnswers = require('./functions/generateaianswers');
// const ExtractRemainderdetails = require('./functions/remainderbot');
// const { GetRemaindersData, InsertRemainderdata, UpdateRemainderstatus } = require('./functions/remainderdbfunctions');
// const { sendEmail } = require('./lib/sentmail')
// const ReframeAnswer = require('./functions/frameanswer');
// const { waitUntil } = require('@vercel/functions');

// const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// const processedEvents = new Set();

// const app = express();

// app.use(express.json());

// app.use(
//   express.urlencoded({
//     extended: true,
//     verify: (req, res, buf) => {
//       req.rawBody = buf.toString("utf8");
//     },
//   })
// );

// app.get("/", (req, res) => {
//   res.send("Welcome to the Slack Backend Server!");
// })


// app.post("/slack/events", async (req, res) => {
//   console.log("Slack request body:", req.body);

//   try {
//     const { type, challenge } = req.body || {};

//     if (type === "url_verification") {
//       return res.status(200).json({
//         challenge: challenge,
//       });
//     }

//     if (type === "event_callback") {

//       console.log("Received Slack event:", req.body.event);

//       const { event, event_id } = req.body;
//       if (processedEvents.has(event_id)) {
//         console.log("Duplicate event ignored:", event_id);
//         return res.sendStatus(200);
//       }

//       processedEvents.add(event_id);

//       if (event.type !== "message" || event.bot_id) {
//         return res.sendStatus(200);
//       }

//       res.sendStatus(200);

//       try {

//         const userMessage = event.text;
//         const channelId = event.channel;

//         const aianswer = await GenerateAiAnswers(userMessage);

//         await slack.chat.postMessage({
//           channel: channelId,
//           text: aianswer,
//         });

//       } catch (error) {
//         console.error("Error processing Slack message:", error);
//       }

//       return;
//     }
//   } catch (err) {
//     console.error("Error processing Slack event:", err);
//   }
// });



// const withTimeout = (promise, ms) =>
//   Promise.race([
//     promise,
//     new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out')), ms)),
//   ]);

// async function postToSlack(responseUrl, text) {
//   try {
//     const r = await fetch(responseUrl, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ response_type: 'in_channel', text }),
//     });
//     console.log('Slack response_url reply:', r.status, await r.text());
//   } catch (err) {
//     console.error('postToSlack error:', err);
//   }
// }

// async function handlePortfolio(userMessage, responseUrl) {
//   try {
//     const answer = await withTimeout(
//       (async () => {
//         const result = await understandQuery(userMessage);
//         console.log('2. understood:', result);
//         const rows = await portfoliocount(result);
//         console.log('3. rows:', rows);
//         return ReframeAnswer(userMessage, rows);
//       })(),
//       25000
//     );
//     console.log('4. answer:', answer);
//     await postToSlack(responseUrl, answer);
//     console.log('5. posted');
//   } catch (error) {
//     console.error('Error:', error);
//     await postToSlack(responseUrl, 'Sorry, something went wrong. Please try again.');
//   }
// }




// app.post("/slack/commands", async (req, res) => {
//   if (req.body.command === '/assisstant') {
//     res.status(200).send(`Hello! This is Jimmy. How can I assist you with you ?`);
//   }


//   if (req.body.command === '/portfolio') {
//     // Keep the function alive after the response is sent
//     waitUntil(handlePortfolio(req.body.text, req.body.response_url));

//     res.status(200).send(); // ack Slack immediately
//     console.log('1. ack sent');
//     return;
//   }


//   if (req.body.command === '/websearch') {
//     const userMessage = req.body.text;

//     const aianswer = await GenerateAiAnswers(userMessage);
//     res.status(200).send(aianswer);
//   }
//   if (req.body.command === '/remainder') {
//     const userMessage = req.body.text;
//     const result = await ExtractRemainderdetails(userMessage);
//     const jsondata = JSON.parse(result);
//     console.log("Remainder extraction result:", typeof jsondata);

//     const insertResult = await InsertRemainderdata(task = jsondata.reminder_message, sent = jsondata.reminder_time);

//     const converted_time = new Date(jsondata.reminder_time).toLocaleString('en-US', { timeZone: 'UTC' }, { hour12: true, hour: 'numeric', minute: 'numeric', day: 'numeric' });
//     if (insertResult) {
//       res.status(200).send(`Remainder was initiated successfully on ${converted_time}`);
//     }
//     else {
//       res.status(500).send(`Something went wrong! Try again later.`);
//     }
//   }
// })

// app.get("/slack/checkremainders", async (req, res) => {
//   const remainder = await GetRemaindersData();

//   let mail_sent = 0

//   for (const data of remainder) {
//     try {
//       const mail = await sendEmail(data.task, data.sent_at);

//       if (mail) {
//         mail_sent++

//         const update = await UpdateRemainderstatus(data.id, "SENT")
//       }

//     } catch (err) {
//       console.error("Error while sending email for remainder id:", data.id, err);
//     }
//   }
//   res.status(200).send(`Remainders checked. Emails sent: ${mail_sent}`);
// })


// app.listen(process.env.PORT_NO, () => {
//   console.log(`Server is running on port ${process.env.PORT_NO}`);
// })




const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const pool = require('./lib/db');
const portfoliocount = require('./functions/portfoliocount');
const { understandQuery } = require('./functions/aibot');
const { WebClient } = require('@slack/web-api');
const GenerateAiAnswers = require('./functions/generateaianswers');
const ExtractRemainderdetails = require('./functions/remainderbot');
const { GetRemaindersData, InsertRemainderdata, UpdateRemainderstatus } = require('./functions/remainderdbfunctions');
const { sendEmail } = require('./lib/sentmail');
const ReframeAnswer = require('./functions/frameanswer');

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// TTL-based event deduplication to prevent memory leaks
const processedEvents = new Set();
const markEventProcessed = (eventId) => {
  processedEvents.add(eventId);
  setTimeout(() => processedEvents.delete(eventId), 5 * 60 * 1000);
};

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
});

// Helper for timeout protection
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out')), ms)),
  ]);

// Helper to post back to Slack response_url
async function postToSlack(responseUrl, text, replaceOriginal = false) {
  try {
    const responseText = typeof text === 'object' ? JSON.stringify(text) : String(text);
    const r = await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'in_channel',
        text: responseText,
        replace_original: replaceOriginal,
      }),
    });
    console.log('Slack response_url reply:', r.status);
  } catch (err) {
    console.error('postToSlack error:', err);
  }
}

// Background handler for /portfolio
async function handlePortfolio(userMessage, responseUrl) {
  try {
    const answer = await withTimeout(
      (async () => {
        const result = await understandQuery(userMessage);
        console.log('2. understood:', result);
        const rows = await portfoliocount(result);
        console.log('3. rows:', rows);
        const framedAnswer = await ReframeAnswer(userMessage, rows);
        return framedAnswer;
      })(),
      25000
    );

    console.log('4. answer ready:', answer);
    await postToSlack(responseUrl, answer, true);
    console.log('5. posted to Slack');
  } catch (error) {
    console.error('handlePortfolio error:', error);
    await postToSlack(responseUrl, '⚠️ Sorry, something went wrong processing your portfolio request. Please try again.', true);
  }
}

// --- SLACK EVENT SUBSCRIPTIONS ---
app.post("/slack/events", async (req, res) => {
  try {
    const { type, challenge, event, event_id } = req.body || {};

    // 1. URL Verification handshake
    if (type === "url_verification") {
      return res.status(200).json({ challenge });
    }

    // 2. Ignore Slack Retries
    if (req.headers["x-slack-retry-num"]) {
      return res.sendStatus(200);
    }

    if (type === "event_callback") {
      // Deduplicate events
      if (processedEvents.has(event_id)) {
        return res.sendStatus(200);
      }
      markEventProcessed(event_id);

      // Ignore non-user messages, edits, and bot messages
      if (!event || event.type !== "message" || event.bot_id || event.subtype) {
        return res.sendStatus(200);
      }

      // Immediately acknowledge Slack
      res.sendStatus(200);

      // Run AI generation asynchronously
      (async () => {
        try {
          const aianswer = await GenerateAiAnswers(event.text);
          await slack.chat.postMessage({
            channel: event.channel,
            thread_ts: event.thread_ts || event.ts,
            text: aianswer,
          });
        } catch (error) {
          console.error("Error processing Slack message:", error);
        }
      })();

      return;
    }
  } catch (err) {
    console.error("Error processing Slack event:", err);
    return res.sendStatus(500);
  }
});

// --- SLACK SLASH COMMANDS ---
app.post("/slack/commands", async (req, res) => {
  const { command, text, response_url } = req.body;

  if (command === '/assisstant' || command === '/assistant') {
    return res.status(200).send(`Hello! This is Jimmy. How can I assist you today?`);
  }

  if (command === '/portfolio') {
    if (!text || text.trim() === '') {
      return res.status(200).send('Please provide a query after `/portfolio` (e.g. `/portfolio summary of tech stocks`)');
    }

    // 1. Immediately acknowledge Slack with a temporary message (< 100ms)
    res.status(200).json({
      response_type: 'in_channel',
      text: `⏳ _Analyzing portfolio query: "${text}"..._`,
    });

    // 2. Process in background and update the message
    handlePortfolio(text, response_url);
    return;
  }

  if (command === '/websearch') {
    // Ack immediately and process via response_url to prevent 3-second timeout
    res.status(200).json({
      response_type: 'in_channel',
      text: `🔍 _Searching: "${text}"..._`,
    });

    (async () => {
      try {
        const aianswer = await GenerateAiAnswers(text);
        await postToSlack(response_url, aianswer, true);
      } catch (err) {
        await postToSlack(response_url, '⚠️ Search failed. Please try again.', true);
      }
    })();
    return;
  }

  if (command === '/remainder' || command === '/reminder') {
    try {
      const result = await ExtractRemainderdetails(text);
      const jsondata = JSON.parse(result);

      const insertResult = await InsertRemainderdata(jsondata.reminder_message, jsondata.reminder_time);

      const converted_time = new Date(jsondata.reminder_time).toLocaleString('en-US', {
        timeZone: 'UTC',
        hour12: true,
        hour: 'numeric',
        minute: 'numeric',
        day: 'numeric',
      });

      if (insertResult) {
        return res.status(200).send(`Reminder was initiated successfully for ${converted_time}`);
      } else {
        return res.status(500).send(`Something went wrong saving the reminder! Try again later.`);
      }
    } catch (err) {
      console.error("Reminder error:", err);
      return res.status(200).send("Could not parse the reminder details. Please try with format: `/reminder call John tomorrow at 4pm`");
    }
  }

  return res.status(200).send();
});

// --- REMINDER CRON CHECK ENDPOINT ---
app.get("/slack/checkremainders", async (req, res) => {
  try {
    const remainder = await GetRemaindersData();
    let mail_sent = 0;

    for (const data of remainder) {
      try {
        const mail = await sendEmail(data.task, data.sent_at);
        if (mail) {
          mail_sent++;
          await UpdateRemainderstatus(data.id, "SENT");
        }
      } catch (err) {
        console.error("Error while sending email for reminder id:", data.id, err);
      }
    }
    res.status(200).send(`Remainders checked. Emails sent: ${mail_sent}`);
  } catch (err) {
    console.error("Check remainders error:", err);
    res.status(500).send("Error checking remainders");
  }
});

const PORT = process.env.PORT_NO || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});