# Use the official lightweight Node.js 18 image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
# This allows Docker to cache the 'npm install' step
COPY package*.json ./

# Install all dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Expose the port our app runs on
EXPOSE 3000

# The command to run when the container starts
CMD ["npm", "start"]
