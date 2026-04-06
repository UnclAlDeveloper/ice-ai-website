# Use Debian-based image so onnxruntime-node (glibc) works; Alpine lacks ld-linux-x86-64.so.2
# Node 22 matches package.json engines (>=22.13.0 <23).
FROM node:22-slim AS base

FROM base AS deps

WORKDIR /app
COPY package.json package-lock.json* ./
# preinstall runs check-npm-cwd before dependencies exist; script must be present for npm ci.
COPY scripts/check-npm-cwd.cjs scripts/check-npm-cwd.cjs
RUN npm ci --legacy-peer-deps

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for NEXT_PUBLIC_* variables (must be available at build time)
ARG NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_API_KEY
ARG NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_VOICE_ID
ARG NEXT_PUBLIC_ELEVENLABS_TEXT2SPEECH_MODEL_NAME
ARG NEXT_PUBLIC_COGNITO_DOMAIN
ARG NEXT_PUBLIC_COGNITO_CLIENT_ID
ARG NEXT_PUBLIC_ANNA_TRAINER_ELEVENLABS_API_KEY

# Set as environment variables for the build
ENV NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_API_KEY=$NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_API_KEY
ENV NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_VOICE_ID=$NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_VOICE_ID
ENV NEXT_PUBLIC_ELEVENLABS_TEXT2SPEECH_MODEL_NAME=$NEXT_PUBLIC_ELEVENLABS_TEXT2SPEECH_MODEL_NAME
ENV NEXT_PUBLIC_COGNITO_DOMAIN=$NEXT_PUBLIC_COGNITO_DOMAIN
ENV NEXT_PUBLIC_COGNITO_CLIENT_ID=$NEXT_PUBLIC_COGNITO_CLIENT_ID
ENV NEXT_PUBLIC_ANNA_TRAINER_ELEVENLABS_API_KEY=$NEXT_PUBLIC_ANNA_TRAINER_ELEVENLABS_API_KEY

RUN npm run db:anna-trainer:generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# install ffmpeg for video processing (apt for Debian-based image)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# creates node.js group and next.js user (--ingroup for Debian so nextjs:nodejs chown works)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs nextjs

# copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# copy standalone output (includes .next and minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# copy onnxruntime-node native binaries (standalone output omits the .so files)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/onnxruntime-node ./node_modules/onnxruntime-node
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/onnxruntime-common ./node_modules/onnxruntime-common

USER nextjs

# set Environment port
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["node", "server.js"]
