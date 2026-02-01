const axios = require('axios');

/**
 * Llama a n8n con un contrato estable (action/payload).
 * n8n debería responder rápido (idealmente < N8N_TIMEOUT_MS) y devolver:
 * - Preferido: { messages: [{ content: "texto" | {..receta..} }] }
 * - Alternativo: arrays/objetos de recetas
 */
async function callN8n(action, payload, from, body) {
  // Por defecto apuntamos al webhook "production" de recetas.
  // Si quieres otro n8n, define N8N_WEBHOOK_URL en el .env
  const url = process.env.N8N_WEBHOOK_URL || 'http://84.247.170.83:5678/webhook/add-recipe';

  const response = await axios.post(
    url,
    {
      ctx: { from, body, action, payload },
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

// Compat: nombre antiguo (antes se llamaba sendEventToWebhook y solo mandaba from/body)
async function sendEventToWebhook(from, body) {
  return callN8n('message', { text: body }, from, body);
}

module.exports = { callN8n, sendEventToWebhook };


