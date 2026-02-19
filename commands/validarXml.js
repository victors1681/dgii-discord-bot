const axios = require("axios");
const FormData = require("form-data");

/**
 * Downloads an XML file from a URL, validates it, and returns a formatted reply string.
 * Shared by the slash command and the message mention handler.
 */
async function validateXmlFromUrl(url, filename) {
  // Download the file
  const fileResponse = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 15000,
  });
  const fileBuffer = Buffer.from(fileResponse.data);
  const fileContent = fileBuffer.toString("utf-8");

  // Check if the document starts with <?xml
  if (!fileContent.trim().startsWith("<?xml")) {
    return "❌ El documento no es válido. Debe comenzar con `<?xml`";
  }

  // Check if it contains the <ECF> tag
  if (!fileContent.includes("<ECF>")) {
    return "❌ El documento no contiene la etiqueta `<ECF>`";
  }

  // Create form-data — send as a file buffer to match curl's @file behavior
  const formData = new FormData();
  formData.append("xml", fileBuffer, {
    filename: filename,
    contentType: "application/xml",
    knownLength: fileBuffer.length,
  });

  // Make POST request
  const response = await axios.post(
    "https://validator.megaplus.com.do/api/xml/validate/",
    formData,
    {
      headers: { ...formData.getHeaders() },
      timeout: 30000,
    },
  );

  if (!response.data) {
    return "✅ Solicitud enviada correctamente. No se recibió respuesta del servidor.";
  }

  const { status, msg, tipoEcf, archivo, errors } = response.data;
  const isSuccess = status === "success";
  let reply = `${isSuccess ? "✅ Validación Exitosa" : "❌ Validación Fallida"}\n**Mensaje:** ${msg}`;

  if (archivo && archivo !== "N/A") reply += `\n**Archivo:** ${archivo}`;
  if (tipoEcf && tipoEcf !== "No identificado")
    reply += `\n**Tipo ECF:** ${tipoEcf}`;

  if (errors && errors.length > 0) {
    const errorLines = errors
      .map((e) => `  • Línea ${e.line} [${e.code}]: ${e.message}`)
      .join("\n");
    reply += `\n**Errores:**\n\`\`\`\n${errorLines}\n\`\`\``;
  }

  reply += `\n-# Validado usando https://validator.megaplus.com.do/`;

  return reply;
}

module.exports = {
  validateXmlFromUrl,
  data: {
    name: "validar_xml",
    description: "Valida un archivo XML de la DGII",
  },

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const attachment = interaction.options.getAttachment("archivo");

      if (!attachment) {
        await interaction.editReply(
          "Por favor, adjunta un archivo XML a validar.",
        );
        return;
      }

      if (!attachment.name.toLowerCase().endsWith(".xml")) {
        await interaction.editReply(
          "❌ El archivo adjunto debe ser un archivo `.xml`",
        );
        return;
      }

      const reply = await validateXmlFromUrl(attachment.url, attachment.name);
      await interaction.editReply(reply);
    } catch (error) {
      console.error("Error validating XML:", error.message);
      if (error.response) {
        await interaction.editReply(
          `❌ Error del servidor de validación:\n\`\`\`json\n${JSON.stringify(
            error.response.data,
            null,
            2,
          )}\n\`\`\``,
        );
      } else {
        await interaction.editReply(
          `❌ Error al validar el XML: ${error.message}`,
        );
      }
    }
  },
};
