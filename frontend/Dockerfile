FROM node:20-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package файлы для кеширования npm install
COPY package*.json ./

# Устанавливаем зависимости (включая dev для vite dev сервера)
RUN npm install --legacy-peer-deps

# Копируем исходный код
COPY . .

# Открываем порт Vite dev сервера
EXPOSE 5173

# Команда по умолчанию — dev сервер (переопределяется в docker-compose)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
