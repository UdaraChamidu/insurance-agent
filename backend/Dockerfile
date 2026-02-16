FROM node:20-alpine

WORKDIR /app

# Install dependencies first (caching)
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

# Environment variables should be injected by Railway/Docker
ENV PORT=3001
EXPOSE 3001

CMD ["npm", "start"]
