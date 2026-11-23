# Dockerfile untuk deployment Next.js (production-ready)
FROM node:20-alpine AS base

# Install OpenSSL yang dibutuhkan oleh Prisma Client
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Tahap 1: Install dependency
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

# Tahap 2: Build aplikasi Next.js
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

# Nonaktifkan telemetry Next.js selama build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Tahap 3: Runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Buat user non-root untuk keamanan kontainer
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/Service-account.json* ./

# Berikan hak akses untuk local database fallback folder
RUN mkdir -p src/db && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Menjalankan sinkronisasi database Prisma, seeding awal, lalu menjalankan aplikasi Next.js
CMD ["sh", "-c", "npx prisma db push && node prisma/seed.js && npm run start"]
