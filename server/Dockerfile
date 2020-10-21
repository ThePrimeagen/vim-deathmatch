FROM node:14
WORKDIR /src
COPY . .
RUN npm install
EXPOSE 42069
CMD ["npx", "ts-node", "src/server.ts"]


