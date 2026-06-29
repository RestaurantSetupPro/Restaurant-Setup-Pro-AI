FROM node:24-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY database ./database
COPY public ./public
COPY src ./src

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

RUN mkdir -p /app/data && chown -R node:node /app
USER node

CMD ["npm", "start"]
