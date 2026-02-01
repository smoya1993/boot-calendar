<h1 align="center">
  <br>
  Chef-Boot (Recetas)
  <br>
</h1>
<h4 align="center">Bot de Telegram para crear, ver, editar, borrar y buscar recetas, delegando el CRUD a n8n.</h4>

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#how-to-use">How To Use</a> •
  <a href="#credits">Credits</a> •
  <a href="#you-may-also-like">Related</a> •
  <a href="#license">License</a>
</p>

## Key Features

- Recetas (menú numérico)
  - Listar recetas
  - Ver receta por ID
  - Buscar recetas
  - Crear receta (asistente por pasos)
  - Editar receta (por campo)
  - Borrar receta
- Integración con n8n
  - El backend llama a un único webhook y n8n implementa el almacenamiento/CRUD

## How To Use

Necesitas [Git](https://git-scm.com) y [Node.js](https://nodejs.org/en/download/) (v18+ recomendado) con npm. Además, necesitas **Telegram** y un workflow de n8n expuesto vía webhook (production).

```bash
git clone <tu-repo>
cd boot-calendar
npm install
npm start
```

## Variables de entorno

- `PORT`: puerto del server (default `4000`)
- `N8N_WEBHOOK_URL`: webhook de n8n (production). Default: `http://84.247.170.83:5678/webhook/add-recipe`
- `N8N_TIMEOUT_MS`: timeout para n8n (default `4000`)
- `TELEGRAM_BOT_TOKEN`: token del bot (BotFather), requerido si usas Telegram
- `TELEGRAM_WEBHOOK_SECRET`: (opcional, recomendado) se valida contra el header `X-Telegram-Bot-Api-Secret-Token`

## Menú del bot

- `1` Listar recetas
- `2` Ver receta (ID)
- `3` Crear receta (wizard)
- `4` Editar receta
- `5` Borrar receta
- `6` Buscar receta
- `0` Cancelar / menú
- `9` Ayuda

## Telegram

### Endpoint

El backend expone un webhook para Telegram en:

- `POST /vote/telegram`

El estado conversacional se guarda por chat (internamente usa `from = telegram:<chatId>`).

### Configurar webhook (producción o local con túnel)

1) Crea tu bot con BotFather y guarda `TELEGRAM_BOT_TOKEN` en `.env`.

2) (Opcional recomendado) Define `TELEGRAM_WEBHOOK_SECRET` en `.env`.

3) Expón tu servicio por HTTPS (dominio o túnel) y configura el webhook:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<TU_DOMINIO_O_TUNEL_HTTPS>/vote/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

4) Abre el chat con tu bot y escribe `9` para ver ayuda o cualquier número del menú.

### Probar en local (ngrok)

1) Arranca el server:

```bash
npm start
```

2) Expón el puerto 4000:

```bash
ngrok http 4000
```

3) Copia la URL HTTPS que te da ngrok y úsala en `setWebhook` (paso anterior).

## Contrato con n8n (webhook único)

El backend hace `POST` a `N8N_WEBHOOK_URL` con:

```json
{
  "ctx": {
    "from": "telegram:123456789",
    "body": "texto original",
    "action": "list|get|search|create|update|delete",
    "payload": {}
  }
}
```

Ejemplos de `payload`:
- `list`: `{ "page": 1 }`
- `get`: `{ "id": "12" }`
- `search`: `{ "query": "barbacoa" }`
- `create`: `{ "recipe": { "title": "...", "description": "...", "cookingTime": "...", "ingredients": [...], "instructions": [...] } }`
- `update`: `{ "id": "12", "patch": { "title": "Nuevo título" } }`
- `delete`: `{ "id": "12" }`

Respuesta recomendada de n8n (rápida, HTTP 200):

```json
{ "messages": [ { "content": "Texto para Telegram" } ] }
```

También se soportan respuestas tipo “receta” (objeto) o arrays de recetas: el backend las formatea a texto.

## Deploy en Linux (PM2)

### 1) Preparar servidor

- Instala Node.js (recomendado Node 18+ o 20+), npm, y git.
- Abre el puerto público solo si NO vas a usar Nginx (recomendado usar Nginx y dejar la app en localhost).

### 2) Subir el proyecto

```bash
git clone <tu-repo>
cd boot-calendar
npm ci --omit=dev
cp env.example .env
```

Edita `.env` con tus valores (tokens/URLs). Nota: en este repo `env.example` es el “.env.example”.

### 3) Instalar PM2 y arrancar

```bash
sudo npm i -g pm2
pm2 start ecosystem.config.js
pm2 status
pm2 logs boot-calendar
```

### 4) Auto-arranque al reiniciar

```bash
pm2 save
pm2 startup
```

PM2 te imprimirá un comando `sudo ...` — ejecútalo.

### 5) (Recomendado) Nginx + HTTPS (webhooks)

Si Telegram va a llamar a tu API, necesitas una URL pública con HTTPS.

Ejemplo de server block (ajusta dominio y SSL):

```nginx
server {
  server_name tu-dominio.com;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Luego saca certificado con Certbot:

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```


## Credits

This application uses the following open source packages:

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Node.js](https://nodejs.org/)
- [ExpressJs](https://expressjs.com/)
- [n8n](https://n8n.io/)

## Support

<a href="https://www.patreon.com/chyke007">
	<img src="https://c5.patreon.com/external/logo/become_a_patron_button@2x.png" width="160">
</a>

## You may also like

- [PC](https://github.com/chyke007/pc) - A Project crashing software for project management
- [Cinema](https://github.com/chyke007/cinemaapp) - A cinema app
- [Yum-Food](https://github.com/chyke007/Yum-food) - A Food ordering app

## License

MIT

---

> [chibuikenwa.com](https://www.chibuikenwa.com) &nbsp;&middot;&nbsp;
> GitHub [@chyke007](https://github.com/chyke007) &nbsp;&middot;&nbsp;
> LinkedIn [@chibuike-nwachukwu-29a7a0111](https://linkedin.com/in/chibuike-nwachukwu-29a7a0111)
