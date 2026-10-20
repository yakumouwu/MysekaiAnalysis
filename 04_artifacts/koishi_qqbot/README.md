# SnowLuma + Koishi

Three services: SnowLuma, Koishi (Mysekai + optional AI plugins), and the existing Python receiver. The LangBot plugin runtime is no longer needed. The receiver keeps `sssekai==0.7.62` and its capture, rendering and notification rules.

## Deployment

Copy `.env.example` to `.env` and set the QQ bot ID, a fresh OneBot token, the receiver API key, and a generated Koishi administrator password. Never commit these values. Run `npm ci` and `npm test` to validate the plugin, then `docker compose build koishi` and `docker compose up -d`. Pin image digests after pulling fixed version tags.

The existing receiver must join `BOT_NETWORK`, use `BOT_PUSH_URL=http://snowluma:3000`, and use the matching `BOT_TOKEN`. Preserve its group/private targets, notification cache, captures and resource-map configuration. Measure render peaks before setting its memory limit (300 MiB is the initial deployment budget).

Management ports bind to host loopback. Use SSH forwarding for 5140 (Koishi), 5099 (SnowLuma) and 6081 (QQ login desktop). OneBot ports 3000/3001 stay inside the Docker network. SnowLuma requires the documented ptrace capability and seccomp setting. Its 1 GiB shared-memory capacity is not preallocated, but actual usage consumes host/container memory. Initial 900/450 MiB memory limits require measurement.

```bash
ssh -N -i <PRIVATE_KEY_PATH> -L 127.0.0.1:5140:127.0.0.1:5140 -L 127.0.0.1:5099:127.0.0.1:5099 -L 127.0.0.1:6081:127.0.0.1:6081 root@<SERVER>
```

Open `http://127.0.0.1:5140/console/` (Koishi), `http://127.0.0.1:5099/` (SnowLuma), and `http://127.0.0.1:6081/vnc.html` (QQ desktop). SnowLuma's WebUI password and noVNC password are separate. Read and confirm the first-run terms in WebUI, change its bootstrap password, enable QQ's automatic login checkbox below the QR code, then scan it. Verify automatic reconnection after a container restart. Before the first WebUI password change, restarting SnowLuma regenerates its bootstrap password. Obtain only the latest value from private startup logs.

## Mysekai

Commands accept `mysk`, `/mysk`, or `!mysk`: `ping`, `bind <game_id>`, `unbind`, `whoami`, `map`, `map site <5|6|7|8>`. IDs remain strings. Bindings persist in `koishi-runtime/data/koishi.db`. Put legacy `{"bindings":{"<qq_id>":"<game_id>"}}` data at `koishi-runtime/data/import-bindings.json` before first start. Existing rows are preserved; successful import renames the file to `.imported`, preventing restart from undoing an unbind. Mount the whole writable runtime directory (owned by UID 1000), allowing Koishi to atomically replace its configuration; binding a single `koishi.yml` file causes EBUSY during configuration saves.

The plugin uses the existing `/api/plugin/mysekai/map` API and `X-API-Key`. Returned images are downloaded through the configured internal receiver address and sent as PNG bytes. Query concurrency is one, cooldown defaults to 60 seconds, and HTTP timeout to 45 seconds. The receiver serializes automatic notification and query renders with a shared lock. All-map queries send separate images; single-site queries include the map label.

## AI

ChatLuna 1.4.3, storage and the OpenAI-compatible adapter are installed but disabled pending operator model configuration. Enable storage, ChatLuna and the configured model adapter after SQLite. Model endpoints, names and keys are intentionally unset. Start with private-chat/group-mention triggers, inference concurrency one, bounded context and text output. Add memory, browsing, rendering and voice only after measuring resources. Verify AI ignores `mysk` commands before enabling group replies.

## Verification and rollback

Check binding import, commands, one/four-map queries, receiver `/healthz`, OneBot login, notification action errors, image sends and restart persistence. Use explicitly designated targets for real sending tests. HTTP 200 with OneBot `status=failed` or nonzero `retcode` is not success.

Back up inspect metadata, receiver source/config, bindings and notification cache. Keep original images and named volumes. LangBot history is incompatible with Koishi: a configuration-only LangBot database can support rollback, with historical monitoring/execution records and stored binaries omitted. Stop the new bot before restoring old containers. Complete QQ login through forwarded noVNC; monitor OOM events, available memory and sustained swap activity before accepting the 2 GiB deployment.

`restore_containers.py` reconstructs selected containers from a private `docker inspect` JSON snapshot, including exact image IDs, networks and existing anonymous named volumes. It never replaces an existing container. Validate first with `python3 restore_containers.py <SNAPSHOT> <CONTAINER_NAMES...> --dry-run`. For receiver rollback, restore its original bind-mounted source as well as its container configuration. Protect snapshots, environment override JSON and runtime directories: they contain credentials. This build excludes runtime data from its Docker context.

Deployment checks on the 2 GiB host passed for SQLite import and restart persistence, QQ automatic login and OneBot reconnection, private-chat commands and image replies, plus single/four-map API rendering. QQ startup and adapter readiness can take several minutes under the resource limits. Before AI configuration, an idle sample of the three containers was about 680 MiB; receiver render peak was about 115 MiB. SnowLuma reached its 900 MiB cap during startup, with no OOM kills observed. These are measurements of this workload, not sustained-load guarantees. ChatLuna model configuration, subsequent AI resource testing and the next real automatic notification remain to be verified.
