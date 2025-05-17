require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");
const axios = require("axios");

const DGII_API_KEY = process.env.DGII_API_KEY; // Make sure to add this to your .env file
const DGII_BASE_URL = "https://statusecf.dgii.gov.do/api/EstatusServicios";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = [
  new SlashCommandBuilder()
    .setName("dgii_status")
    .setDescription("Consulta el estado de los servicios de la DGII.")
    .addStringOption((option) =>
      option
        .setName("servicio")
        .setDescription("El servicio de la DGII a consultar")
        .setRequired(true)
        .addChoices(
          { name: "Obtener Estatus de Servicios", value: "ObtenerEstatus" },
          {
            name: "Obtener Ventanas de Mantenimiento",
            value: "ObtenerVentanasMantenimiento",
          },
          { name: "Verificar Estado de Ambiente", value: "VerificarEstado" }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName("ambiente")
        .setDescription("El ambiente a verificar (para VerificarEstado)")
        .setRequired(false)
        .addChoices(
          { name: "PreCertificacion", value: 1 },
          { name: "Certificacion", value: 2 },
          { name: "Produccion", value: 3 }
        )
    ),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ), // Replace with your client and guild ID
      { body: commands }
    );
    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();

client.on("ready", () => {
  console.log(`Bot is online as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Check if the bot was mentioned in the message
  if (!message.mentions.has(client.user.id)) return;

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

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "dgii_status") {
    const servicio = interaction.options.getString("servicio");
    const ambiente = interaction.options.getInteger("ambiente");

    if (!DGII_API_KEY) {
      await interaction.reply("La clave API de la DGII no está configurada.");
      return;
    }

    let apiUrl = `${DGII_BASE_URL}/${servicio}`;
    const headers = {
      Accept: "*/*",
      Authorization: `Apikey ${DGII_API_KEY}`,
    };

    try {
      await interaction.deferReply();

      let response;
      if (servicio === "VerificarEstado") {
        if (ambiente === null) {
          await interaction.editReply(
            "Para 'VerificarEstado', debes seleccionar un ambiente."
          );
          return;
        }
        apiUrl += `?Ambiente=${ambiente}`;
        response = await axios.get(apiUrl, { headers });
        await interaction.editReply(
          `**Estado del Ambiente ${
            ambiente === 1
              ? "PreCertificacion"
              : ambiente === 2
              ? "Certificacion"
              : "Produccion"
          }:**\n\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``
        );
      } else if (servicio === "ObtenerEstatus") {
        response = await axios.get(apiUrl, { headers });
        const simplifiedEstatus = response.data.map((item) => ({
          servicio: item.servicio,
          estatus: item.estatus,
          ambiente: item.ambiente,
        }));
        await interaction.editReply(
          `**Estatus de Servicios:**\n\`\`\`json\n${JSON.stringify(
            simplifiedEstatus,
            null,
            2
          )}\n\`\`\``
        );
      } else if (servicio === "ObtenerVentanasMantenimiento") {
        response = await axios.get(apiUrl, { headers });
        await interaction.editReply(
          `**Ventanas de Mantenimiento:**\n\`\`\`json\n${JSON.stringify(
            response.data,
            null,
            2
          )}\n\`\`\``
        );
      }
    } catch (error) {
      console.error(
        "Error fetching DGII status:",
        error.response ? error.response.data : error.message
      );
      await interaction.editReply(
        "Hubo un error al consultar el servicio de la DGII."
      );
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
