FROM node:22-bookworm@sha256:5647be709086c696ff32edaaf1c70cd26d1da6ab2b39c32f3c7b4c4a31957e37

RUN apt-get update \
	&& apt-get install --yes --no-install-recommends chromium \
	&& rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/chromium \
	HOME=/tmp

USER node
WORKDIR /workspace

ENTRYPOINT ["node", "scripts/run-karma.mjs"]
