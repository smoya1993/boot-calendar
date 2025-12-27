const express = require('express');
const router = express.Router();
const { MessagingResponse } = require('twilio').twiml;

const responses = require('./responses');
const { callN8n } = require('./webhookClient');
const { normalizeWebhookContent } = require('./recipeFormatters');

// Estado conversacional en memoria (por usuario). Para HA, migrar a Redis.
const userState = new Map();

const Steps = {
  MAIN: 'MAIN',
  VIEW_ID: 'VIEW_ID',
  SEARCH_QUERY: 'SEARCH_QUERY',
  CREATE_TITLE: 'CREATE_TITLE',
  CREATE_DESC: 'CREATE_DESC',
  CREATE_TIME: 'CREATE_TIME',
  CREATE_ING: 'CREATE_ING',
  CREATE_INS: 'CREATE_INS',
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
      userState.set(from, { step: Steps.CREATE_TITLE, data: {} });
      return responses.createTitle();
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
  if (t === '0') {
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

    case Steps.CREATE_TITLE:
      st.data.title = t;
      st.step = Steps.CREATE_DESC;
      return responses.createDescription();

    case Steps.CREATE_DESC:
      st.data.description = t;
      st.step = Steps.CREATE_TIME;
      return responses.createCookingTime();

    case Steps.CREATE_TIME:
      st.data.cookingTime = t;
      st.step = Steps.CREATE_ING;
      return responses.createIngredients();

    case Steps.CREATE_ING:
      st.data.ingredients = parseList(t);
      st.step = Steps.CREATE_INS;
      return responses.createInstructions();

    case Steps.CREATE_INS: {
      st.data.instructions = parseSteps(text);
      const recipe = {
        title: st.data.title,
        description: st.data.description,
        cookingTime: st.data.cookingTime,
        ingredients: st.data.ingredients,
        instructions: st.data.instructions,
      };
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

router.post('/', async function (req, res) {
    const twiml = new MessagingResponse();
  const body = req.body.Body || '';
  const from = req.body.From || 'unknown';

  try {
    getOrInitUser(from);

    // si llega vacío, devolvemos menú
    const input = safeText(body);
    const message = input.length === 0 ? responses.menu() : await handleStep(from, input);
    twiml.message(message);
        return res.status(200).send(twiml.toString());
    } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error recipes bot:', error?.message || error);
    twiml.message(responses.n8nError());
    return res.status(200).send(twiml.toString());
  }
});

module.exports = router;
