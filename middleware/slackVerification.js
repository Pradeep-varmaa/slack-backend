const crypto = require("crypto");

function verifySlackRequest(req, res, next) {
  try {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;

    if (!signingSecret) {
      console.error("SLACK_SIGNING_SECRET is missing");

      return res.status(500).json({
        error: "Server configuration error",
      });
    }

    const timestamp = req.headers["x-slack-request-timestamp"];
    const slackSignature = req.headers["x-slack-signature"];

    if (!timestamp || !slackSignature) {
      return res.status(401).json({
        error: "Missing Slack signature headers",
      });
    }

    const currentTime = Math.floor(Date.now() / 1000);

    const requestAge = Math.abs(currentTime - Number(timestamp));

    if (requestAge > 60 * 5) {
      return res.status(401).json({
        error: "Request timestamp is too old",
      });
    }

    const rawBody = req.rawBody || "";

    const basestring = `v0:${timestamp}:${rawBody}`;

    const calculatedSignature =
      "v0=" +
      crypto
        .createHmac("sha256", signingSecret)
        .update(basestring)
        .digest("hex");

    const calculatedBuffer = Buffer.from(calculatedSignature, "utf8");
    const slackBuffer = Buffer.from(slackSignature, "utf8");

    if (
      calculatedBuffer.length !== slackBuffer.length ||
      !crypto.timingSafeEqual(calculatedBuffer, slackBuffer)
    ) {
      return res.status(401).json({
        error: "Invalid Slack signature",
      });
    }

    next();

  } catch (error) {
    console.error("Slack verification error:", error);

    return res.status(401).json({
      error: "Invalid Slack request",
    });
  }
}

module.exports = verifySlackRequest;