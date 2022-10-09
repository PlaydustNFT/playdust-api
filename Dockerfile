FROM node:16-bullseye-slim

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
COPY ./entrypoint.sh /
RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
