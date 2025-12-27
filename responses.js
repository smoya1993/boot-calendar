const responses = {
  menu: () => `
🍳 Chef-Boot (Recetas)

1 - Listar recetas
2 - Ver receta (por ID)
3 - Crear receta
4 - Editar receta
5 - Borrar receta
6 - Buscar receta

0 - Cancelar / Menú
9 - Ayuda
`.trim(),

  help: () => `
Ayuda (Recetas)

1) Listar: muestra recetas (si n8n devuelve un array, se formatea en lista)
2) Ver: te pedirá un ID
3) Crear: asistente por pasos (título, descripción, tiempo, ingredientes, pasos)
4) Editar: ID + campo a editar
5) Borrar: ID + confirmación
6) Buscar: texto (título/ingredientes, lo que implemente n8n)

Tip: en ingredientes usa coma (,) y en pasos usa | (barra vertical) o saltos de línea.
`.trim(),

  unknown: () => `No te entiendo. Responde con un número del menú.\n\n${responses.menu()}`,

  askIdToView: () => 'Escribe el ID de la receta que quieres ver (0 para volver al menú).',
  askQuery: () => 'Escribe el texto a buscar (0 para volver al menú).',

  createTitle: () => 'Crear receta: dime el *título* (0 para cancelar).',
  createDescription: () => 'Crear receta: dime una *descripción* corta (0 para cancelar).',
  createCookingTime: () => 'Crear receta: tiempo de preparación (ej: 15 min) (0 para cancelar).',
  createIngredients: () => 'Crear receta: ingredientes separados por coma. Ej: huevo, leche, sal (0 para cancelar).',
  createInstructions: () => 'Crear receta: pasos separados por | o por líneas. Ej: mezclar | hornear (0 para cancelar).',

  editAskId: () => 'Editar receta: escribe el ID (0 para cancelar).',
  editAskField: () => `¿Qué quieres editar?\n1 - Título\n2 - Descripción\n3 - Tiempo\n4 - Ingredientes\n5 - Pasos\n6 - Imagen\n0 - Cancelar`,
  editAskValue: (fieldLabel) => `Nuevo valor para *${fieldLabel}* (0 para cancelar).`,

  deleteAskId: () => 'Borrar receta: escribe el ID (0 para cancelar).',
  deleteConfirm: (id) => `¿Seguro que quieres borrar la receta ${id}?\n1 - Sí\n0 - No (cancelar)`,

  cancelled: () => `Cancelado.\n\n${responses.menu()}`,

  n8nError: () => 'Recibido ✅ (no pude procesarlo ahora mismo). Inténtalo de nuevo en unos segundos.',
};

module.exports = responses;