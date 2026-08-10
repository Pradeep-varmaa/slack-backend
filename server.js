const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const pool = require('./lib/db');
const portfoliocount = require('./middleware/portfoliocount')
const { understandQuery } = require('./middleware/aibot');

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

app.post("/slack/events", (req, res) => {
  console.log("Slack request body:", req.body);

  const { type, challenge } = req.body || {};
  if (type === "url_verification") {
    return res.status(200).json({
      challenge: challenge,
    });
  }

  if (type === "event_callback") {
    const { event } = req.body;
    console.log("Event type:", event.type);

    if (event.type === "message") {
      console.log("User:", event.user);
      console.log("Message:", event.text);
      res.send("Message event received").status(200);
    }
  }

  return res.status(200).send("Event received");
});

app.post("/slack/commands", (req, res) => {
  console.log("Slack command request body:", req.body);
  if (req.body.command === '/assisstant') {
    res.status(200).send(`Hello Mr.${req.body.user_name}! How can I assist you with you ?`);
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

app.listen(process.env.PORT_NO, () => {
  console.log(`Server is running on port ${process.env.PORT_NO}`);
})
