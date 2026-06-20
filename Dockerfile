# Portable container — deploy on Railway, Fly.io, Cloud Run, a VPS, anywhere.
FROM node:24-alpine
WORKDIR /app
COPY . .
RUN npm install --omit=dev
ENV PORT=3000
EXPOSE 3000
CMD ["node", "--no-warnings", "server.js"]
