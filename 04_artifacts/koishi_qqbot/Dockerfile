FROM node:24-bookworm-slim
WORKDIR /opt/koishi
COPY package.json package-lock.json ./
COPY plugins ./plugins
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY koishi.yml ./koishi.yml
COPY entrypoint.sh /usr/local/bin/koishi-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/koishi-entrypoint && chmod 755 /usr/local/bin/koishi-entrypoint \
    && mkdir -p /koishi && chown -R node:node /opt/koishi /koishi
WORKDIR /koishi
USER node
ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
EXPOSE 5140
CMD ["/usr/local/bin/koishi-entrypoint"]
