# Step 1: Use an official Node.js runtime as a parent image
# 'slim' reduces image size and attack surface
FROM node:18-slim

# Step 2: Set the working directory in the container
WORKDIR /usr/src/app

# Step 3: Copy package files first to leverage Docker layer caching
# This ensures 'npm install' only runs when dependencies change
COPY package*.json ./

# Step 4: Install only production dependencies
#RUN npm install --only=production
# Step 4: Use 'npm ci' for faster, more reliable builds
RUN npm ci --only=production && npm cache clean --force

# Step 5: Copy the rest of your application code
COPY . .

# Step 6: Expose the port the app runs on (matching your code)
EXPOSE 8080

# Step 7: Security Best Practice - Run as a non-root user
# The official node image includes a user named 'node'
USER node

# Step 8: Define the command to run your app
CMD [ "node", "index.js" ]