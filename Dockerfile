FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ARG N8N_WEBHOOK_URL=http://84.247.170.83:5678/webhook/add-recipe
ENV N8N_WEBHOOK_URL=${N8N_WEBHOOK_URL}

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "index.js"]


