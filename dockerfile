# Tahap 1: Build React App
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Tahap 2: Setup Server (Nginx) biar ringan
FROM nginx:alpine
# Catatan: Kalau projectmu pakai CRA (bukan Vite), ganti 'dist' jadi 'build' di bawah ini
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]