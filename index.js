require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  REST,
  Routes,
} = require("discord.js");
const axios = require("axios");
const validarXmlCommand = require("./commands/validarXml");

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
          { name: "Verificar Estado de Ambiente", value: "VerificarEstado" },
        ),
    )
    .addIntegerOption((option) =>
      option
        .setName("ambiente")
        .setDescription("El ambiente a verificar (para VerificarEstado)")
        .setRequired(false)
        .addChoices(
          { name: "PreCertificacion", value: 1 },
          { name: "Certificacion", value: 2 },
          { name: "Produccion", value: 3 },
        ),
    ),
  new SlashCommandBuilder()
    .setName("validar_xml")
    .setDescription("Valida un archivo XML de la DGII")
    .addAttachmentOption((option) =>
      option
        .setName("archivo")
        .setDescription("Archivo XML a validar (.xml)")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("validar_xml_reply")
    .setDescription("Responde a un mensaje con XML adjunto para validarlo"),
  new ContextMenuCommandBuilder()
    .setName("Validar XML")
    .setType(ApplicationCommandType.Message),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID,
      ), // Replace with your client and guild ID
      { body: commands },
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

  // Check for XML attachment — either on this message or on the replied-to message
  let xmlAttachment = message.attachments.find((a) =>
    a.name.toLowerCase().endsWith(".xml"),
  );

  if (!xmlAttachment && message.reference?.messageId) {
    try {
      const repliedTo = await message.channel.messages.fetch(
        message.reference.messageId,
      );
      xmlAttachment = repliedTo.attachments.find((a) =>
        a.name.toLowerCase().endsWith(".xml"),
      );
    } catch {
      // ignore fetch error, fall through to normal handler
    }
  }

  if (xmlAttachment) {
    try {
      const { validateXmlFromUrl } = require("./commands/validarXml");
      const result = await validateXmlFromUrl(
        xmlAttachment.url,
        xmlAttachment.name,
      );
      await message.reply(result);
    } catch (err) {
      console.error("Error validating XML:", err.message);
      await message.reply(`❌ Error al validar el XML: ${err.message}`);
    }
    return;
  }

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
      },
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
  if (!interaction.isCommand() && !interaction.isMessageContextMenuCommand())
    return;

  const { commandName } = interaction;

  if (commandName === "validar_xml") {
    await validarXmlCommand.execute(interaction);
    return;
  }

  if (commandName === "validar_xml_reply") {
    await interaction.deferReply();
    try {
      // Fetch the full channel to avoid partial/Missing Access errors
      const channel = await client.channels.fetch(interaction.channelId);
      const messages = await channel.messages.fetch({ limit: 10 });

      const targetMessage = messages.find((m) =>
        m.attachments.some((a) => a.name.toLowerCase().endsWith(".xml")),
      );

      if (!targetMessage) {
        await interaction.editReply(
          "❌ No se encontró ningún mensaje reciente con un archivo `.xml` adjunto.",
        );
        return;
      }

      const xmlAttachment = targetMessage.attachments.find((a) =>
        a.name.toLowerCase().endsWith(".xml"),
      );

      const { validateXmlFromUrl } = require("./commands/validarXml");
      const reply = await validateXmlFromUrl(
        xmlAttachment.url,
        xmlAttachment.name,
      );
      await interaction.editReply(reply);
    } catch (error) {
      console.error("Error in validar_xml_reply:", error.message);
      await interaction.editReply(
        `❌ Error al validar el XML: ${error.message}`,
      );
    }
    return;
  }

  if (commandName === "Validar XML") {
    await interaction.deferReply();
    try {
      const targetMessage = interaction.targetMessage;
      const xmlAttachment = targetMessage.attachments.find((a) =>
        a.name.toLowerCase().endsWith(".xml"),
      );

      if (!xmlAttachment) {
        await interaction.editReply(
          "❌ El mensaje seleccionado no tiene ningún archivo `.xml` adjunto.",
        );
        return;
      }

      const { validateXmlFromUrl } = require("./commands/validarXml");
      const reply = await validateXmlFromUrl(
        xmlAttachment.url,
        xmlAttachment.name,
      );
      await interaction.editReply(reply);
    } catch (error) {
      console.error("Error in Validar XML context menu:", error.message);
      await interaction.editReply(
        `❌ Error al validar el XML: ${error.message}`,
      );
    }
    return;
  }

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
            "Para 'VerificarEstado', debes seleccionar un ambiente.",
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
          }:**\n\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``,
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
            2,
          )}\n\`\`\``,
        );
      } else if (servicio === "ObtenerVentanasMantenimiento") {
        response = await axios.get(apiUrl, { headers });
        await interaction.editReply(
          `**Ventanas de Mantenimiento:**\n\`\`\`json\n${JSON.stringify(
            response.data,
            null,
            2,
          )}\n\`\`\``,
        );
      }
    } catch (error) {
      console.error(
        "Error fetching DGII status:",
        error.response ? error.response.data : error.message,
      );
      await interaction.editReply(
        "Hubo un error al consultar el servicio de la DGII.",
      );
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
