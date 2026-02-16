FROM node:20-alpine

WORKDIR /app

# Install dependencies first (caching)
COPY package*.json ./
RUN npm install --production
# if it showes an error, use this command
# npm install --omit=dev --legacy-peer-deps



# Copy source
COPY . .

# Environment variables should be injected by Railway/Docker
ENV PORT=3001
EXPOSE 3001

CMD ["npm", "start"]
