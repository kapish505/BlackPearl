FROM ubuntu:24.04

# Install Node.js 20 and curl
RUN apt-get update && \
    apt-get install -y curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Download and install Coral CLI
RUN curl -sL https://github.com/withcoral/coral/releases/download/v0.4.1/coral-x86_64-unknown-linux-gnu.tar.gz -o coral.tar.gz && \
    tar -xzf coral.tar.gz && \
    mkdir -p bin && \
    mv coral bin/coral && \
    chmod +x bin/coral && \
    rm coral.tar.gz

# Copy application code
COPY . .

EXPOSE 3001

CMD ["npm", "start"]
