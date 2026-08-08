const express = require('express');

const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.get("/", (req, res)=>{
  res.send("Hello Varma! This is a slack server for testing slack events and commands.");
})

app.post('/slack/events', (req, res) => {
  const { type, challenge } = req.body;

  // Slack URL Verification
  if (type === 'url_verification') {
    return res.status(200).json({
      challenge: challenge
    });
  }

  // Normal Slack events
  console.log('Slack Event:', req.body);

  return res.status(200).send('Event received');
});



app.listen(process.env.PORT_NO, () => {
  console.log(`Server is running on port ${process.env.PORT_NO}`);
}
)