const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const { WebClient } = require('@slack/web-api');
const pool = require('./lib/db');
const portfoliocount = require('./functions/portfoliocount');
const { understandQuery } = require('./functions/aibot');
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

// In-memory set for deduplicating Slack event callbacks with TTL cleanup
const processedEvents = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [id, timestamp] of processedEvents.entries()) {
    if (now - timestamp > 10 * 60 * 1000) {
      processedEvents.delete(id);
    }
  }
}, 5 * 60 * 1000);

const app = express();

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);

// Helper to post messages back to Slack via response_url
async function postToSlack(responseUrl, text, responseType = 'in_channel') {
  if (!responseUrl) {
    console.warn('postToSlack: No response_url provided.');
    return;
  }
  try {
    const res = await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: responseType,
        text,
      }),
    });
    console.log(`Slack response_url (${responseUrl.slice(0, 30)}...) status:`, res.status);
  } catch (err) {
    console.error('postToSlack error:', err);
  }
}

// Timeout helper for long-running async tasks
const withTimeout = (promise, ms = 25000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), ms)),
  ]);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Slack Backend Server is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: err.message });
  }
});

// ==========================================
// SLACK EVENTS ENDPOINT
// ==========================================
app.post('/slack/events', async (req, res) => {
  try {
    const { type, challenge, event, event_id } = req.body || {};

    // 1. Slack URL Verification Challenge
    if (type === 'url_verification') {
      return res.status(200).json({ challenge });
    }

    // 2. Event Callback
    if (type === 'event_callback' && event) {
      if (processedEvents.has(event_id)) {
        console.log('Duplicate event ignored:', event_id);
        return res.sendStatus(200);
      }
      processedEvents.set(event_id, Date.now());

      // Ignore bot messages to prevent infinite loops
      if (event.bot_id || event.subtype === 'bot_message') {
        return res.sendStatus(200);
      }

      // Handle message or app_mention events
      if (event.type === 'message' || event.type === 'app_mention') {
        // Acknowledge receipt immediately to avoid Slack retries
        res.sendStatus(200);

        // Process event asynchronously
        (async () => {
          try {
            let rawText = event.text || '';
            // Remove bot user mention (<@U...>)
            const userMessage = rawText.replace(/<@[A-Z0-9]+>/g, '').trim();
            const channelId = event.channel;
            const threadTs = event.thread_ts || event.ts;

            if (!userMessage) {
              await slack.chat.postMessage({
                channel: channelId,
                thread_ts: threadTs,
                text: "👋 Hello! How can I help you today? You can ask me questions, check portfolio analytics, search information, or set reminders!",
              });
              return;
            }

            console.log(`Processing Slack message event in channel ${channelId}: "${userMessage}"`);

            // Generate AI response
            const aianswer = await GenerateAiAnswers(userMessage);

            await slack.chat.postMessage({
              channel: channelId,
              thread_ts: threadTs,
              text: aianswer,
            });
          } catch (error) {
            console.error('Error processing Slack event message:', error);
            try {
              await slack.chat.postMessage({
                channel: event.channel,
                thread_ts: event.thread_ts || event.ts,
                text: "⚠️ Sorry, I encountered an error while processing your request. Please try again.",
              });
            } catch (postErr) {
              console.error('Error sending fallback error message:', postErr);
            }
          }
        })();
        return;
      }

      return res.sendStatus(200);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('Error handling /slack/events:', err);
    return res.sendStatus(500);
  }
});

// ==========================================
// SLACK SLASH COMMANDS ENDPOINT
// ==========================================
app.post('/slack/commands', async (req, res) => {
  const { command, text = '', response_url, user_id, channel_id, user_name } = req.body;
  const userMessage = (text || '').trim();

  console.log(`Received command: ${command} from user: ${user_name || user_id} with text: "${userMessage}"`);

  // Acknowledge immediately to avoid Slack's 3-second timeout
  res.status(200).send();

  // Route commands asynchronously
  try {
    // 1. Assistant Command (/assisstant or /assistant)
    if (command === '/assisstant' || command === '/assistant') {
      (async () => {
        try {
          if (!userMessage) {
            const welcomeText = `👋 *Hello <@${user_id}>! I'm Jimmy, your AI Assistant.*\n\nHere are some things I can do for you:\n• \`/portfolio <question>\` — Get visitor metrics and analytics\n• \`/websearch <query>\` — Ask any question or search information\n• \`/remainder <task> <time>\` — Schedule email and Slack reminders\n• \`/assistant <question>\` — Chat with me directly`;
            await postToSlack(response_url, welcomeText, 'ephemeral');
            return;
          }

          const answer = await withTimeout(GenerateAiAnswers(userMessage));
          await postToSlack(response_url, answer);
        } catch (error) {
          console.error('Error handling /assistant command:', error);
          await postToSlack(response_url, '⚠️ Sorry, I could not process your request right now.');
        }
      })();
      return;
    }

    // 2. Portfolio Analytics Command (/portfolio)
    if (command === '/portfolio') {
      (async () => {
        try {
          const queryToAnalyze = userMessage || 'Show visitor summary';
          const answer = await withTimeout(
            (async () => {
              const result = await understandQuery(queryToAnalyze);
              console.log('Query understanding result:', result);

              if (!result || result.success === false) {
                return result && result.message
                  ? result.message
                  : 'I could not match that query to portfolio visitor data. Try asking about total visitors, visitors today, or top locations!';
              }

              const rows = await portfoliocount(result);
              console.log('SQL Query executed. Rows returned:', rows);

              return await ReframeAnswer(queryToAnalyze, rows);
            })()
          );

          await postToSlack(response_url, answer);
        } catch (error) {
          console.error('Error handling /portfolio command:', error);
          await postToSlack(response_url, '⚠️ Sorry, something went wrong while fetching portfolio analytics.');
        }
      })();
      return;
    }

    // 3. Web / AI Search Command (/websearch or /search)
    if (command === '/websearch' || command === '/search') {
      (async () => {
        try {
          if (!userMessage) {
            await postToSlack(
              response_url,
              '🔍 Please provide a question or topic to search. Example: `/websearch What is Docker and how does it work?`',
              'ephemeral'
            );
            return;
          }

          const aianswer = await withTimeout(GenerateAiAnswers(userMessage));
          await postToSlack(response_url, aianswer);
        } catch (error) {
          console.error('Error handling /websearch command:', error);
          await postToSlack(response_url, '⚠️ Sorry, I could not complete the search. Please try again.');
        }
      })();
      return;
    }

    // 4. Reminders Command (/remainder or /reminder)
    if (command === '/remainder' || command === '/reminder') {
      (async () => {
        try {
          if (!userMessage) {
            await postToSlack(
              response_url,
              '⏰ *How to use reminders:*\n`/remainder Remind me tomorrow at 10 AM to call John`\n`/remainder Remind me in 30 minutes to check deployment`',
              'ephemeral'
            );
            return;
          }

          const rawResult = await withTimeout(ExtractRemainderdetails(userMessage));
          const jsondata = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;

          console.log('Reminder parsing result:', jsondata);

          if (!jsondata.is_reminder || !jsondata.reminder_time || !jsondata.reminder_message) {
            await postToSlack(
              response_url,
              '⚠️ I could not understand the reminder details. Please include both what to do and when (e.g., `/remainder Remind me tomorrow at 5 PM to submit report`).',
              'ephemeral'
            );
            return;
          }

          // Insert into database
          await InsertRemainderdata(
            jsondata.reminder_message,
            jsondata.reminder_time,
            user_id,
            channel_id
          );

          const formattedTime = new Date(jsondata.reminder_time).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'full',
            timeStyle: 'short',
          });

          const confirmationMessage = `🔔 *Reminder Scheduled!*\n• *Task:* ${jsondata.reminder_message}\n• *When:* ${formattedTime} (IST)\n• *Created by:* <@${user_id}>`;
          await postToSlack(response_url, confirmationMessage);
        } catch (error) {
          console.error('Error handling /remainder command:', error);
          await postToSlack(response_url, '⚠️ Something went wrong setting the reminder. Please try again later.');
        }
      })();
      return;
    }

    // Fallback for unrecognized commands
    await postToSlack(
      response_url,
      `❓ Unrecognized command \`${command}\`. Available commands are: \`/assistant\`, \`/portfolio\`, \`/websearch\`, and \`/remainder\`.`,
      'ephemeral'
    );
  } catch (err) {
    console.error('Top-level command handler error:', err);
  }
});

// ==========================================
// REMINDER CHECK & DISPATCH ENDPOINT
// ==========================================
app.get('/slack/checkremainders', async (req, res) => {
  try {
    const reminders = await GetRemaindersData();
    console.log(`Checking reminders: Found ${reminders.length} pending reminder(s).`);

    let slackSent = 0;
    let mailSent = 0;

    for (const reminder of reminders) {
      try {
        const formattedTime = new Date(reminder.sent_at).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'short',
        });

        // 1. Send Slack notification if channel_id or user_id exists
        const targetChannel = reminder.channel_id || reminder.user_id;
        if (targetChannel && process.env.SLACK_BOT_TOKEN) {
          try {
            const userTag = reminder.user_id ? `<@${reminder.user_id}> ` : '';
            await slack.chat.postMessage({
              channel: targetChannel,
              text: `⏰ ${userTag}*Reminder Alert!* \n\n*Task:* ${reminder.task}\n*Scheduled time:* ${formattedTime}`,
            });
            slackSent++;
          } catch (slackErr) {
            console.error(`Failed to post reminder ${reminder.id} to Slack channel ${targetChannel}:`, slackErr);
          }
        }

        // 2. Send Email notification
        const mailResult = await sendEmail(reminder.task, reminder.sent_at);
        if (mailResult) {
          mailSent++;
        }

        // 3. Update database status
        await UpdateRemainderstatus(reminder.id, 'SENT');
      } catch (itemErr) {
        console.error(`Error dispatching reminder ID ${reminder.id}:`, itemErr);
      }
    }

    res.status(200).json({
      success: true,
      pendingCount: reminders.length,
      slackNotificationsSent: slackSent,
      emailsSent: mailSent,
    });
  } catch (err) {
    console.error('Error during reminder check:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to process reminders',
    });
  }
});

const PORT = process.env.PORT_NO || process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await ensureRemainderTable();
    console.log('Database tables verified.');
  } catch (e) {
    console.error('Database initialization warning:', e.message);
  }
});
