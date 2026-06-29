FROM node:24-alpine

WORKDIR /app
COPY package.json ./
COPY database ./database
COPY public ./public
COPY src ./src

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

RUN mkdir -p /app/data && chown -R node:node /app
USER node

CMD ["node", "src/server.mjs"]
