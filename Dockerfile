FROM node:6.8

WORKDIR /usr/src/app

COPY package.json .
RUN npm install

COPY . .

EXPOSE 3000

ENTRYPOINT ["npm", "start"]
