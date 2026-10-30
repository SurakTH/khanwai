FROM node:24.22.2-alpine

ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 DATA_DIR=/data
WORKDIR /app
COPY --chown=node:node package.json server.mjs ./
COPY --chown=node:node public/ ./public/
COPY --chown=node:node src/ ./src/
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4173
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
