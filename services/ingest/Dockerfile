FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install
COPY index.js ./
EXPOSE 4301
CMD ["node","index.js"]
