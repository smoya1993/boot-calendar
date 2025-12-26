const axios = require('axios');

/**
 * Envía el mensaje entrante a un webhook externo (n8n) para procesarlo.
 * Espera una respuesta con estructura tipo: { messages: [{ content: "..." }, ...] }
 */
async function sendEventToWebhook(from, body) {
  // Por defecto apuntamos al n8n local del servidor.
  // Si quieres otro n8n, define N8N_WEBHOOK_URL en el .env
  const url = process.env.N8N_WEBHOOK_URL || 'http://127.0.0.1:5678/webhook-test/add-recipe';

  const response = await axios.post(
    url,
    {
      ctx: { from, body },
    },
    {
      // Importante para webhooks (Twilio/Telegram): no colgar el request indefinidamente
      timeout: Number(process.env.N8N_TIMEOUT_MS || 4000),
      validateStatus: () => true,
    }
  );

  // Si n8n responde error, lo tratamos como fallo
  if (response.status >= 400) {
    const msg = `n8n returned status ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    err.data = response.data;
    throw err;
  }

  return response.data;
}

module.exports = { sendEventToWebhook };


