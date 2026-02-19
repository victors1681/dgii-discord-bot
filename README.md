# DGII Discord Bot

Bot oficial del servidor **eCF-Dominicana** en Discord. Proporciona herramientas para consultar los servicios de la DGII y validar comprobantes fiscales electrónicos (e-CF) en formato XML.

---

## Comandos

### `/dgii_status`
Consulta el estado de los servicios de la DGII.

| Opción | Descripción |
|--------|-------------|
| `ObtenerEstatus` | Obtiene el estatus de todos los servicios |
| `ObtenerVentanasMantenimiento` | Lista las ventanas de mantenimiento programadas |
| `VerificarEstado` | Verifica el estado de un ambiente específico (PreCertificación, Certificación, Producción) |

---

### `/validar_xml`
Valida un archivo XML de e-CF adjuntando el archivo directamente al comando.

- Adjunta el archivo `.xml` en el campo `archivo`
- Verifica que el documento comience con `<?xml` y contenga la etiqueta `<ECF>`
- Envía el archivo al validador y retorna el resultado

---

### `/validar_xml_reply`
Valida el XML adjunto de un mensaje reciente en el canal.

- Escanea los últimos 10 mensajes buscando un archivo `.xml`
- Útil cuando alguien ya subió el XML y quieres validarlo sin buscarlo manualmente

> **Requiere** que el bot tenga los permisos **View Channel** y **Read Message History** en el canal.

---

### Menú contextual — `Validar XML`
Valida el XML adjunto de un mensaje específico.

1. Clic derecho (o mantén presionado en móvil) sobre el mensaje con el `.xml`
2. Selecciona **Apps → Validar XML**

---

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
DISCORD_TOKEN=tu_token_de_discord
CLIENT_ID=tu_application_id
GUILD_ID=tu_server_id
DGII_API_KEY=tu_api_key_de_la_dgii
API_ENDPOINT=url_del_endpoint_de_ia
```

---

## Instalación local

```bash
npm install
npm start
```

---

## Despliegue en producción (AWS EC2)

### Primera vez

```bash
# Conectarse al servidor
ssh ec2-user@<ip-del-servidor>

# Clonar el repositorio
git clone <repo-url>
cd dgii-discord-bot

# Instalar dependencias
npm install

# Crear el archivo .env con las variables de entorno
nano .env

# Iniciar con PM2
pm2 start index.js --name dgii-discord-bot
pm2 save
pm2 startup
```

### Actualizar a la última versión

```bash
# Conectarse al servidor
ssh ec2-user@<ip-del-servidor>

# Ir al directorio del proyecto
cd dgii-discord-bot

# Descargar los últimos cambios
git pull

# Instalar nuevas dependencias (si las hay)
npm install

# Reiniciar el proceso
pm2 restart dgii-discord-bot
```

### Otros comandos PM2 útiles

```bash
pm2 list                        # Ver todos los procesos
pm2 logs dgii-discord-bot       # Ver logs en tiempo real
pm2 status dgii-discord-bot     # Ver estado del proceso
pm2 stop dgii-discord-bot       # Detener el bot
```

---

## Permisos requeridos del bot en Discord

- `View Channel`
- `Send Messages`
- `Read Message History`
- `Use Application Commands`
