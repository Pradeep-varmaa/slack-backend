const express = require('express');

const dotenv = require('dotenv');

dotenv.config();

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

  return res.status(200).send("Event received");
});

app.post("/slack/commands", (req, res) => {
  console.log("Slack command request body:", req.body); 
  res.status(200).send(`Hello MR ${req.body.user_name}! How can I assist you with you ?`);
})


app.listen(process.env.PORT_NO, () => {
  console.log(`Server is running on port ${process.env.PORT_NO}`);
}
)