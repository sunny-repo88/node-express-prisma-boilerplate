FROM node:buster

RUN mkdir -p /usr/src/node-app
WORKDIR /usr/src/node-app

COPY package.json package-lock.json ./

RUN chown -R node:node /usr/src/node-app  # Change ownership to the 'node' user

USER node

RUN npm install


COPY --chown=node:node . .

EXPOSE 3000
