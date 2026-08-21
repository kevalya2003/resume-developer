# Built on a slim Node base rather than the Playwright image, which carries
# Firefox and WebKit as well — around 600MB this app never launches. Deleting
# them afterwards would not help, because a layer can only add: the bytes stay
# in the image no matter what a later RUN removes. Installing just Chromium
# instead takes the result from roughly 3.8GB to about a third of that.
#
# Keep PLAYWRIGHT_VERSION in step with the playwright entry in package.json, so
# the browser build and the client that drives it cannot diverge.
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts skips postinstall: it downloads browsers, which are installed
# deliberately in the runner stage, and syncs fonts, which needs source files
# that are not in this stage.
RUN npm ci --ignore-scripts


FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prebuild syncs the fonts into public/fonts, so a missing font is a build
# failure here rather than a silent substitution at render time.
RUN npm run build


FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    # Outside the default home directory so the browser stays readable after the
    # switch to a non-root user.
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    # The container is the isolation boundary here. Chromium's own sandbox needs
    # privileges that would have to be granted with --cap-add=SYS_ADMIN, which is
    # a worse trade than dropping it inside an already-confined, non-root process.
    # Unset this and grant that capability if your platform allows it.
    RESUME_CHROMIUM_NO_SANDBOX=1

# Standalone output ships its own minimal node_modules; static assets and public
# files are not part of it and have to be copied alongside.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Chromium and only the system libraries it needs. Runs before the user switch
# because --with-deps installs apt packages.
RUN node node_modules/playwright-core/cli.js install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --system --create-home --shell /usr/sbin/nologin app \
    && chown -R app:app /app
USER app

EXPOSE 3000

# Reports unhealthy when the fonts are missing, which is the one failure that
# would otherwise serve confident-looking but wrong PDFs.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
