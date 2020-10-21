FROM node:14
WORKDIR /src
COPY . .
RUN npm install
EXPOSE 42069
CMD ["/usr/local/bin/node", "./node_modules/.bin/ts-node", "src/index.ts"]


