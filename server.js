const express = require('express');

const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.get("/", (req, res)=>{
  res.send("Hello Varma! This is a slack server for testing slack events and commands.");
})

app.use(express.json());

app.post("/slack/events", (req, res) => {
  console.log("Slack request body:", req.body);

  const { type, challenge } = req.body || {};
  if (type === "url_verification") {
    return res.status(200).json({
      challenge: challenge,
    });
  }

  // Normal Slack events
  return res.status(200).send("Event received");
});


app.listen(process.env.PORT_NO, () => {
  console.log(`Server is running on port ${process.env.PORT_NO}`);
}
)