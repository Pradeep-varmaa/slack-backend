const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const pool = require('./lib/db');
const portfoliocount = require('./functions/portfoliocount');
const { understandQuery } = require('./functions/aibot');
const { WebClient } = require('@slack/web-api');
const GenerateAiAnswers = require('./functions/generateaianswers');
const ExtractRemainderdetails = require('./functions/remainderbot');
const {
  GetRemaindersData,
  InsertRemainderdata,
  UpdateRemainderstatus,
  ensureRemainderTable
} = require('./functions/remainderdbfunctions');
const { sendEmail } = require('./lib/sentmail');
const ReframeAnswer = require('./functions/frameanswer');

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

const withTimeout = (promise, ms = 20000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), ms)),
  ]);

async function postToSlack(responseUrl, text, responseType = 'in_channel', channelId = null) {
  const messageText = typeof text === 'string' ? text : JSON.stringify(text || '');
  let posted = false;

  if (responseUrl) {
    try {
      const r = await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: responseType,
          text: messageText,
        }),
      });
      console.log('Slack response_url reply status:', r.status);
      if (r.ok) posted = true;
    } catch (err) {
      console.error('postToSlack error:', err);
    }
  }

  // Fallback direct post via WebClient if response_url failed or missing
  if (!posted && channelId && process.env.SLACK_BOT_TOKEN) {
    try {
      await slack.chat.postMessage({
        channel: channelId,
        text: messageText,
      });
      console.log(`Fallback message posted directly to channel ${channelId}`);
    } catch (slackErr) {
      console.error('Direct slack post fallback error:', slackErr);
    }
  }
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Welcome to the Slack Backend Server!",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", database: err.message });
  }
});

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

      if (event.bot_id || event.subtype === 'bot_message') {
        return res.sendStatus(200);
      }

      if (event.type === "message" || event.type === "app_mention") {
        res.sendStatus(200);

        try {
          const rawText = event.text || '';
          const userMessage = rawText.replace(/<@[A-Z0-9]+>/g, '').trim();
          const channelId = event.channel;

          if (!userMessage) {
            await slack.chat.postMessage({
              channel: channelId,
              text: "👋 Hello! How can I help you today? You can ask questions, check portfolio analytics, or set reminders!",
            });
            return;
          }

          const aianswer = await GenerateAiAnswers(userMessage);

          const postParams = {
            channel: channelId,
            text: aianswer,
          };
          if (event.thread_ts) {
            postParams.thread_ts = event.thread_ts;
          }

          await slack.chat.postMessage(postParams);
        } catch (error) {
          console.error("Error processing Slack message event:", error);
        }

        return;
      }

      return res.sendStatus(200);
    }
  } catch (err) {
    console.error("Error processing Slack event:", err);
    return res.sendStatus(500);
  }
});

app.post("/slack/commands", async (req, res) => {
  const { command, text = '', response_url, user_id, channel_id } = req.body || {};
  const userMessage = (text || '').trim();

  // Acknowledge immediately to avoid Slack's 3-second timeout
  res.status(200).send();

  try {
    if (command === '/assisstant' || command === '/assistant') {
      (async () => {
        try {
          if (!userMessage) {
            await postToSlack(
              response_url,
              `👋 Hello <@${user_id}>! I'm Jimmy. How can I assist you today? You can ask me questions, query portfolio stats with \`/portfolio\`, search topics with \`/websearch\`, or set reminders with \`/remainder\`.`,
              'in_channel',
              channel_id
            );
            return;
          }
          const answer = await withTimeout(GenerateAiAnswers(userMessage));
          await postToSlack(response_url, answer, 'in_channel', channel_id);
        } catch (err) {
          console.error('Error in assistant command:', err);
          await postToSlack(response_url, 'Sorry, something went wrong processing your request.', 'in_channel', channel_id);
        }
      })();
      return;
    }

    if (command === '/portfolio') {
      (async () => {
        try {
          const queryText = userMessage || 'How many visitors visited total?';
          const answer = await withTimeout(
            (async () => {
              const result = await understandQuery(queryText);
              console.log('SQL converter result:', result);

              if (!result || result.success === false) {
                return result && result.message
                  ? result.message
                  : 'Could not match that query to portfolio visitor data. Try asking about visitor counts for today, yesterday, or all time!';
              }

              const rows = await portfoliocount(result);
              console.log('DB rows:', rows);

              return await ReframeAnswer(queryText, rows);
            })(),
            20000
          );

          console.log('Reframed answer:', answer);
          await postToSlack(response_url, answer, 'in_channel', channel_id);
        } catch (error) {
          console.error('Error in /portfolio handler:', error);
          await postToSlack(response_url, 'Sorry, something went wrong while processing your portfolio query.', 'in_channel', channel_id);
        }
      })();
      return;
    }

    if (command === '/websearch' || command === '/search') {
      (async () => {
        try {
          if (!userMessage) {
            await postToSlack(response_url, '🔍 Please specify what you would like to search. Example: `/websearch What is Docker?`', 'in_channel', channel_id);
            return;
          }
          const aianswer = await withTimeout(GenerateAiAnswers(userMessage));
          await postToSlack(response_url, aianswer, 'in_channel', channel_id);
        } catch (err) {
          console.error('Error in /websearch handler:', err);
          await postToSlack(response_url, 'Sorry, something went wrong fetching search results.', 'in_channel', channel_id);
        }
      })();
      return;
    }

    if (command === '/remainder' || command === '/reminder') {
      (async () => {
        try {
          if (!userMessage) {
            await postToSlack(response_url, '⏰ How to use: `/remainder Remind me tomorrow at 10 AM to send report`', 'in_channel', channel_id);
            return;
          }

          const rawResult = await withTimeout(ExtractRemainderdetails(userMessage));
          const jsondata = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
          console.log("Remainder extraction result:", jsondata);

          if (!jsondata.is_reminder || !jsondata.reminder_time || !jsondata.reminder_message) {
            await postToSlack(
              response_url,
              '⚠️ Could not extract reminder details. Please include what to do and when (e.g. `/remainder Remind me tomorrow at 3 PM to submit work`).',
              'in_channel',
              channel_id
            );
            return;
          }

          await InsertRemainderdata(jsondata.reminder_message, jsondata.reminder_time, user_id, channel_id);

          const converted_time = new Date(jsondata.reminder_time).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'full',
            timeStyle: 'short'
          });

          await postToSlack(
            response_url,
            `🔔 *Reminder set!*\n• *Task:* ${jsondata.reminder_message}\n• *Scheduled for:* ${converted_time} (IST)`,
            'in_channel',
            channel_id
          );
        } catch (err) {
          console.error('Error in /remainder handler:', err);
          await postToSlack(response_url, 'Something went wrong setting the reminder. Try again later.', 'in_channel', channel_id);
        }
      })();
      return;
    }
  } catch (topErr) {
    console.error('Top-level slash command error:', topErr);
  }
});

app.get("/slack/checkremainders", async (req, res) => {
  try {
    const remainder = await GetRemaindersData();
    let mail_sent = 0;
    let slack_sent = 0;

    for (const data of remainder) {
      try {
        const formattedTime = new Date(data.sent_at).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'short'
        });

        // Send Slack message if channel_id or user_id exists
        const targetChannel = data.channel_id || data.user_id;
        if (targetChannel && process.env.SLACK_BOT_TOKEN) {
          try {
            await slack.chat.postMessage({
              channel: targetChannel,
              text: `⏰ *Reminder Alert!*\n\n*Task:* ${data.task}\n*Scheduled time:* ${formattedTime}`,
            });
            slack_sent++;
          } catch (slackErr) {
            console.error('Error sending slack reminder alert:', slackErr);
          }
        }

        // Send Email
        const mail = await sendEmail(data.task, data.sent_at);
        if (mail) {
          mail_sent++;
        }

        await UpdateRemainderstatus(data.id, "SENT");
      } catch (err) {
        console.error("Error while sending email for remainder id:", data.id, err);
      }
    }
    res.status(200).send(`Remainders checked. Slack alerts sent: ${slack_sent}, Emails sent: ${mail_sent}`);
  } catch (err) {
    console.error("Error checking remainders:", err);
    res.status(500).send("Error checking remainders");
  }
});

const PORT = process.env.PORT || process.env.PORT_NO || 3000;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await ensureRemainderTable();
  } catch (e) {
    console.error('DB init warning:', e.message);
  }
});
