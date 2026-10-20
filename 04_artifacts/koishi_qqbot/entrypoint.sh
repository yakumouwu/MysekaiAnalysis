#!/bin/sh
set -eu
if [ ! -e /koishi/node_modules ]; then
  ln -s /opt/koishi/node_modules /koishi/node_modules
fi
if [ ! -f /koishi/koishi.yml ]; then
  cp /opt/koishi/koishi.yml /koishi/koishi.yml
fi
mkdir -p /koishi/data
if [ ! -f /koishi/package.json ]; then
  cp /opt/koishi/package.json /koishi/package.json
fi
exec node /opt/koishi/node_modules/koishi/bin.js start
