# Use a lightweight Node.js image
FROM node:18-alpine

# Install build dependencies required by bcrypt native compilation
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port your Express app runs on
EXPOSE 5000

# Start the server with nodemon
CMD ["npm", "start"]
