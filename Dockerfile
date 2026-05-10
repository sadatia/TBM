FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
# Create the specific folder for the database
RUN mkdir -p db_folder && chmod 777 db_folder
EXPOSE 4460
CMD ["node", "server.js"]