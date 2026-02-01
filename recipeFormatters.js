function getRecipeId(recipe) {
  if (!recipe || typeof recipe !== 'object') return null;
  return recipe.id ?? recipe.recipeId ?? recipe._id ?? recipe.uuid ?? null;
}

function formatRecipeDetail(recipe) {
  if (!recipe || typeof recipe !== 'object') return null;
  if (typeof recipe.title !== 'string' || !recipe.title.trim()) return null;

  const title = recipe.title.trim();
  const id = getRecipeId(recipe);

  const cookingTime = recipe.cookingTime ? String(recipe.cookingTime).trim() : null;
  const caloriesRaw = recipe.calories ? String(recipe.calories).trim() : null;
  const calories = caloriesRaw && caloriesRaw !== '0' && caloriesRaw.toLowerCase() !== 'n/a' ? `${caloriesRaw} kcal` : null;

  const parts = [];
  parts.push(`🍽️ ${title}${id ? ` (ID: ${id})` : ''}`);
  if (cookingTime || calories) parts.push([cookingTime, calories].filter(Boolean).join(' · '));
  if (typeof recipe.description === 'string' && recipe.description.trim()) parts.push(recipe.description.trim());

  if (Array.isArray(recipe.ingredients) && recipe.ingredients.length) {
    const top = recipe.ingredients.slice(0, 10).map(String);
    parts.push(`Ingredientes: ${top.join(', ')}${recipe.ingredients.length > 10 ? '…' : ''}`);
  }
  if (Array.isArray(recipe.instructions) && recipe.instructions.length) {
    const top = recipe.instructions.slice(0, 3).map(String);
    parts.push(`Pasos: ${top.join(' ')}${recipe.instructions.length > 3 ? '…' : ''}`);
  }

  return parts.filter(Boolean).join('\n');
}

function formatRecipeList(recipes) {
  if (!Array.isArray(recipes) || recipes.length === 0) return 'No hay recetas.';
  const top = recipes.slice(0, 10);
  const lines = top.map((r) => {
    const id = getRecipeId(r);
    const title = (r && typeof r.title === 'string' && r.title.trim()) ? r.title.trim() : '(sin título)';
    return `${id ?? '-'} - ${title}`;
  });
  return `📚 Recetas:\n${lines.join('\n')}${recipes.length > 10 ? `\n… (${recipes.length} total)` : ''}`;
}

/**
 * Convierte la respuesta de n8n en un string para WhatsApp.
 * Soporta:
 * - {messages:[{content:"..."}]}
 * - {messages:[{content:{...receta...}}]}
 * - [{messages:[{content:{...}}]}]
 * - arrays de recetas
 * - {recipes:[...]}
 */
function normalizeWebhookContent(webhookResponse) {
  const msgContent = webhookResponse?.messages?.[0]?.content;
  if (typeof msgContent === 'string' && msgContent.trim()) return msgContent.trim();
  if (msgContent && typeof msgContent === 'object') {
    const d = formatRecipeDetail(msgContent);
    if (d) return d;
  }

  const first = Array.isArray(webhookResponse) ? webhookResponse[0] : webhookResponse;
  if (!first || typeof first !== 'object') return null;

  const firstMsgContent = first?.messages?.[0]?.content;
  if (typeof firstMsgContent === 'string' && firstMsgContent.trim()) return firstMsgContent.trim();
  if (firstMsgContent && typeof firstMsgContent === 'object') {
    const d = formatRecipeDetail(firstMsgContent);
    if (d) return d;
  }

  // {recipes:[...]} o array directo
  const recipes = Array.isArray(first.recipes) ? first.recipes : (Array.isArray(webhookResponse) ? webhookResponse : null);
  if (Array.isArray(recipes)) {
    if (recipes.length === 1) return formatRecipeDetail(recipes[0]) || formatRecipeList(recipes);
    return formatRecipeList(recipes);
  }

  // objeto receta directo
  const d = formatRecipeDetail(first);
  if (d) return d;

  if (typeof first.content === 'string' && first.content.trim()) return first.content.trim();
  return null;
}

module.exports = {
  getRecipeId,
  formatRecipeDetail,
  formatRecipeList,
  normalizeWebhookContent,
};






