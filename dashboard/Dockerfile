FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# next dev is used so NEXT_PUBLIC_* vars are read from the runtime environment
# rather than being baked in at build time
CMD ["npm", "run", "dev"]
