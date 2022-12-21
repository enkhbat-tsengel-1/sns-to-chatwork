const https = require("https");
const AWS = require("aws-sdk");

const ROOM_ID = process.env.ROOM_ID;

const ssm = new AWS.SSM();
const tokenPromise = ssm
  .getParameter({ Name: "/chatwork_send_message/token", WithDecryption: true })
  .promise();

exports.sendChatworkMessageHandler = async (event) => {
  let messages = JSON.stringify(event, null, 2);

  if (event.Records[0] && event.Records[0].EventSource === "aws:sns") {
    messages = event.Records.map((record) => {
      let message = record.Sns.Message;
      try {
        message = JSON.stringify(JSON.parse(message), null, 2);
      } catch (error) {
        console.error(error);
      }
      return message;
    }).join("\n");
  }

  try {
    await sendMessage(`[code]${messages}[/code]`);
  } catch (error) {
    console.error(error);
  }
};

async function sendMessage(message) {
  const {
    Parameter: { Value: chatworkToken },
  } = await tokenPromise;
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams({
      body: message,
      self_unread: 0,
    }).toString();

    const options = {
      hostname: "api.chatwork.com",
      port: 443,
      path: `/v2/rooms/${ROOM_ID}/messages`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-ChatWorkToken": chatworkToken,
        "Content-Length": data.length,
      },
    };

    const req = https.request(options, (res) => {
      let result = {
        headers: res.headers,
        body: "",
      };
      res.on("data", (chunk) => {
        result.body += chunk;
      });
      res.on("end", () => {
        resolve(result);
      });
    });

    req.on("error", (error) => {
      console.error(error);
      reject(error, null);
    });
    req.write(data);
    req.end();
  });
}
