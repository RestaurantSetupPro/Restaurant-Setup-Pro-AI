FROM node:24-alpine
ARG CACHE_BUST=20260629-01

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY database ./database
COPY public ./public
COPY src ./src

ENV NODE_ENV=production
ENV HOST=0.0.0.0

RUN mkdir -p /app/data && chown -R node:node /app
USER node

CMD ["npm", "start"]
