require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on("ready", () => {
  console.log(`Bot is online as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  console.log(`[${message.author.username}] ${message.content}`);

  try {
    const response = await axios.post(
      process.env.API_ENDPOINT,
      {
        userInput: `Eres un asistente experto en la DGII. Responde siempre en español. Pregunta: ${message.content}`,
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Accept: "application/json",
          "Accept-Language": "es",
        },
      }
    );
    console.log("Response from API:", response.data);

    let replyMessage = "Respuesta no encontrada.";

    if (response.data && typeof response.data.body === "string") {
      try {
        const parsedBody = JSON.parse(response.data.body);
        if (
          parsedBody.completion &&
          typeof parsedBody.completion === "string"
        ) {
          const completionString = parsedBody.completion.trim();
          const completionData = JSON.parse(completionString);
          if (
            completionData.result &&
            typeof completionData.result === "string"
          ) {
            replyMessage = completionData.result;
          }
        }
      } catch (parseError) {
        console.error("Error parsing API response body:", parseError);
        replyMessage = "Error al procesar la respuesta de la API.";
      }
    }
    message.reply(replyMessage);
  } catch (err) {
    console.error("Error:", err.message);
    message.reply("Oops! Something went wrong.");
  }
});

client.login(process.env.DISCORD_TOKEN);
