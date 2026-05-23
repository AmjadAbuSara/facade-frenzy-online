FROM node:18-alpine

WORKDIR /app

# Copy server package files
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm install

# Copy client source, build it
COPY client/ ./client/
RUN cd client && npm install && npm run build

# Copy server source
COPY server.ts tsconfig.json ./

EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]