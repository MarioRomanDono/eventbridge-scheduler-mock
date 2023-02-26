# syntax=docker/dockerfile:1

FROM node:18-alpine
WORKDIR /app
COPY ["package.json", "package-lock.json*", "./"]
COPY ["tsconfig.json", "./"]
COPY ["src", "./src"]
RUN npm install
RUN npm run build

FROM node:18-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install --production
COPY --from=0 /app/dist ./dist
CMD [ "node", "dist/index.js" ]
