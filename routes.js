const express = require('express');
const router = express.Router();
const axios = require('axios');

const responses = require('./responses');
const { callN8n } = require('./webhookClient');
const { normalizeWebhookContent } = require('./recipeFormatters');

// Estado conversacional en memoria (por usuario). Para HA, migrar a Redis.
const userState = new Map();

const Steps = {
  MAIN: 'MAIN',
  VIEW_ID: 'VIEW_ID',
  SEARCH_QUERY: 'SEARCH_QUERY',
  CREATE_BOOT_INPUT: 'CREATE_BOOT_INPUT',
  CREATE_BOOT_CONFIRM: 'CREATE_BOOT_CONFIRM',
  EDIT_ID: 'EDIT_ID',
  EDIT_FIELD: 'EDIT_FIELD',
  EDIT_VALUE: 'EDIT_VALUE',
  DELETE_ID: 'DELETE_ID',
  DELETE_CONFIRM: 'DELETE_CONFIRM',
};

function getOrInitUser(from) {
  if (!userState.has(from)) userState.set(from, { step: Steps.MAIN, data: {} });
  return userState.get(from);
}

function resetUser(from) {
  userState.set(from, { step: Steps.MAIN, data: {} });
}

function parseList(input) {
  return String(input)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSteps(input) {
  const raw = String(input).trim();
  if (!raw) return [];
  // Soporta "|" o líneas
  const parts = raw.includes('|') ? raw.split('|') : raw.split('\n');
  return parts.map((s) => s.trim()).filter(Boolean);
}

function safeText(x) {
  return String(x || '').trim();
}

async function telegramSendMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');

  return axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
  });
}

async function telegramAnswerCallbackQuery(callbackQueryId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  if (!callbackQueryId) return null;
  return axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId,
  });
}

function extractTelegramInput(update) {
  // Soporta:
  // - update.message.text
  // - update.edited_message.text
  // - update.callback_query.data
  const message = update?.message || update?.edited_message || null;
  if (message?.chat?.id) {
    return {
      chatId: message.chat.id,
      text: message.text || '',
    };
  }

  const cq = update?.callback_query;
  const chatId = cq?.message?.chat?.id;
  if (chatId) {
    return {
      chatId,
      text: cq?.data || '',
      callbackQueryId: cq?.id,
    };
  }

  return null;
}

function extractRecipeCandidate(webhookResponse) {
  // soporta {messages:[{content:{...}}]}
  const msgContent = webhookResponse?.messages?.[0]?.content;
  if (msgContent && typeof msgContent === 'object') return msgContent;
  // soporta [{messages:[{content:{...}}]}]
  if (Array.isArray(webhookResponse)) {
    const first = webhookResponse[0];
    const firstMsg = first?.messages?.[0]?.content;
    if (firstMsg && typeof firstMsg === 'object') return firstMsg;
  }
  // soporta receta directa (objeto) o array de recetas
  if (webhookResponse && typeof webhookResponse === 'object' && typeof webhookResponse.title === 'string') return webhookResponse;
  if (Array.isArray(webhookResponse) && webhookResponse[0] && typeof webhookResponse[0] === 'object') return webhookResponse[0];
  return null;
}

async function handleMain(from, bodyText) {
  switch (bodyText) {
    case '1': {
      const data = await callN8n('list', { page: 1 }, from, bodyText);
      const content = normalizeWebhookContent(data) || 'No hay recetas.';
      // Después de listar, permitimos que el usuario ponga un ID directamente
      userState.set(from, { step: Steps.VIEW_ID, data: {} });
      return `${content}\n\n${responses.askIdToView()}`;
    }
    case '2': {
      userState.set(from, { step: Steps.VIEW_ID, data: {} });
      return responses.askIdToView();
    }
    case '3': {
      userState.set(from, { step: Steps.CREATE_BOOT_INPUT, data: {} });
      return responses.createBootInput();
    }
    case '4': {
      userState.set(from, { step: Steps.EDIT_ID, data: {} });
      return responses.editAskId();
    }
    case '5': {
      userState.set(from, { step: Steps.DELETE_ID, data: {} });
      return responses.deleteAskId();
    }
    case '6': {
      userState.set(from, { step: Steps.SEARCH_QUERY, data: {} });
      return responses.askQuery();
    }
    case '9': {
      return responses.help();
    }
    default:
      return responses.unknown();
  }
}

async function handleStep(from, text) {
  const st = getOrInitUser(from);
  const t = safeText(text);

  // Global cancel
  if (t === '0' && st.step !== Steps.CREATE_BOOT_CONFIRM) {
    resetUser(from);
    return responses.cancelled();
  }
  // Global help
  if (t === '9') {
    return responses.help();
  }

  switch (st.step) {
    case Steps.MAIN:
      return handleMain(from, t);

    case Steps.VIEW_ID: {
      const id = t;
      const data = await callN8n('get', { id }, from, text);
      const content = normalizeWebhookContent(data) || 'No content available';
      resetUser(from);
      return `${content}\n\n${responses.menu()}`;
    }

    case Steps.SEARCH_QUERY: {
      const query = t;
      const data = await callN8n('search', { query }, from, text);
      const content = normalizeWebhookContent(data) || 'Sin resultados.';
      // tras búsqueda, dejamos a usuario poner un ID
      userState.set(from, { step: Steps.VIEW_ID, data: {} });
      return `${content}\n\n${responses.askIdToView()}`;
    }

    case Steps.CREATE_BOOT_INPUT: {
      // El usuario escribe todo en un único mensaje. Se lo pasamos tal cual a n8n.
      const raw = text;
      const data = await callN8n('create_boot', { text: raw }, from, text);
      const candidate = extractRecipeCandidate(data);

      // Guardamos el JSON para el paso de confirmación
      st.data.candidate = candidate;
      st.data.candidateRawResponse = data;
      st.step = Steps.CREATE_BOOT_CONFIRM;

      const content = normalizeWebhookContent(data) || (candidate ? normalizeWebhookContent(candidate) : null) || 'Borrador generado.';
      return `${content}\n\n${responses.createBootConfirm()}`;
    }

    case Steps.CREATE_BOOT_CONFIRM: {
      // En este paso 0 = correcta, 1 = volver
      if (t === '1') {
        userState.set(from, { step: Steps.CREATE_BOOT_INPUT, data: {} });
        return responses.createBootInput();
      }
      if (t !== '0') {
        return responses.createBootConfirm();
      }

      const recipe = st.data.candidate;
      if (!recipe) {
        // Si por algún motivo no tenemos candidato, pedimos reiniciar
        userState.set(from, { step: Steps.CREATE_BOOT_INPUT, data: {} });
        return `No tengo la receta candidata para confirmar. Vamos a empezar de nuevo.\n\n${responses.createBootInput()}`;
      }

      // 2) Confirmado: ahora sí, alta definitiva en n8n
      const data = await callN8n('create', { recipe }, from, text);
      const content = normalizeWebhookContent(data) || 'Receta creada.';
      resetUser(from);
      return `${content}\n\n${responses.menu()}`;
    }

    case Steps.EDIT_ID:
      st.data.id = t;
      st.step = Steps.EDIT_FIELD;
      return responses.editAskField();

    case Steps.EDIT_FIELD: {
      const fieldMap = {
        '1': { key: 'title', label: 'Título' },
        '2': { key: 'description', label: 'Descripción' },
        '3': { key: 'cookingTime', label: 'Tiempo' },
        '4': { key: 'ingredients', label: 'Ingredientes' },
        '5': { key: 'instructions', label: 'Pasos' },
        '6': { key: 'image', label: 'Imagen' },
      };
      const chosen = fieldMap[t];
      if (!chosen) return responses.editAskField();
      st.data.field = chosen.key;
      st.data.fieldLabel = chosen.label;
      st.step = Steps.EDIT_VALUE;
      return responses.editAskValue(chosen.label);
    }

    case Steps.EDIT_VALUE: {
      const id = st.data.id;
      const field = st.data.field;
      let value = t;
      if (field === 'ingredients') value = parseList(t);
      if (field === 'instructions') value = parseSteps(text);
      const patch = { [field]: value };
      const data = await callN8n('update', { id, patch }, from, text);
      const content = normalizeWebhookContent(data) || 'Receta actualizada.';
      resetUser(from);
      return `${content}\n\n${responses.menu()}`;
    }

    case Steps.DELETE_ID:
      st.data.id = t;
      st.step = Steps.DELETE_CONFIRM;
      return responses.deleteConfirm(t);

    case Steps.DELETE_CONFIRM: {
      const id = st.data.id;
      if (t !== '1') {
        resetUser(from);
        return responses.cancelled();
      }
      const data = await callN8n('delete', { id }, from, text);
      const content = normalizeWebhookContent(data) || `Receta ${id} borrada.`;
      resetUser(from);
      return `${content}\n\n${responses.menu()}`;
    }

    default:
      resetUser(from);
      return responses.menu();
  }
}

router.get('/health', function (req, res) {
  return res.status(200).json({ ok: true });
});

router.get('/', function (req, res) {
  return res.status(200).json({
    message: 'Boot-calendar is running. Use POST /vote/telegram as Telegram webhook.',
  });
});

// Telegram webhook endpoint
// Configura Telegram para enviar updates aquí (setWebhook) y usa TELEGRAM_WEBHOOK_SECRET si quieres verificar el header.
router.post('/telegram', async function (req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'Missing TELEGRAM_BOT_TOKEN' });

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const gotSecret = req.header('X-Telegram-Bot-Api-Secret-Token');
    if (gotSecret !== expectedSecret) return res.status(401).json({ error: 'Unauthorized' });
  }

  const input = extractTelegramInput(req.body);
  // Si no es un mensaje soportado, devolvemos 200 para evitar reintentos
  if (!input?.chatId) return res.sendStatus(200);

  const chatId = input.chatId;
  const from = `telegram:${chatId}`;

  try {
    // Para callback queries, respondemos rápido al "loading" (best effort)
    if (input.callbackQueryId) {
      // fire-and-forget (no bloquea)
      telegramAnswerCallbackQuery(input.callbackQueryId).catch(() => null);
    }

    getOrInitUser(from);

    const text = safeText(input.text);
    const reply = text.length === 0 ? responses.menu() : await handleStep(from, text);

    await telegramSendMessage(chatId, reply);
    return res.sendStatus(200);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error telegram bot:', error?.message || error);
    try {
      await telegramSendMessage(chatId, responses.n8nError());
    } catch (sendErr) {
      // eslint-disable-next-line no-console
      console.error('Error sending telegram message:', sendErr?.message || sendErr);
    }
    return res.sendStatus(200);
  }
});

module.exports = router;
