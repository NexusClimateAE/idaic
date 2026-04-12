# Stage 1: Build the React portal
FROM node:20-alpine AS builder

WORKDIR /app

# Build args for Vite (baked into the JS bundle at build time)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_PORTAL_BASE_URL

# Install root dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy logo referenced by portal components via ../../../idaic_black.png
COPY idaic_black.png ./

# Build portal
COPY portal/ ./portal/
WORKDIR /app/portal
RUN npm install --force
RUN VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_PORTAL_BASE_URL=$VITE_PORTAL_BASE_URL \
    npm run build

# Rename index.html to app.html (mirrors netlify.toml build command)
RUN mv dist/index.html dist/app.html

# Build tailwind for public pages
WORKDIR /app
COPY public/tailwind-input.css ./public/tailwind-input.css
COPY tailwind.public.config.js ./
RUN npx tailwindcss -i ./public/tailwind-input.css -o ./public/tailwind.css --minify -c ./tailwind.public.config.js

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

# Copy root package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy the Express server
COPY server.js ./

# Copy netlify functions (unchanged — server.js wraps them)
COPY netlify/ ./netlify/

# Copy static public files
COPY public/ ./public/

# Copy the built React app into public/
COPY --from=builder /app/portal/dist/ ./public/

# Copy compiled tailwind CSS from builder
COPY --from=builder /app/public/tailwind.css ./public/tailwind.css

EXPOSE 3000

CMD ["node", "server.js"]
