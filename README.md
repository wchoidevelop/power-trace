# Power Trace

An AI app for analyzing organizational power and workplace conflict. It maps power in an organization using the French & Raven bases of power, then combines that map with BLS labor data and an LLM to analyze a specific workplace situation.

## Layout

| Folder    | What it is                                                     |
| --------- | -------------------------------------------------------------- |
| `app/`    | Expo / React Native client (iOS, Android, web)                 |
| `server/` | Next.js API server (MongoDB, OpenAI, BLS)                      |
| `docs/`   | Project overview ([HTML](docs/power-trace-overview.html), [PDF](docs/Power-Trace-Overview.pdf)) |

## Setup

You need Node.js, a MongoDB database, an OpenAI API key and a (free) BLS API key.

```bash
# server
cd server
cp .env.example .env      # fill in the values
npm install
npm run dev               # http://localhost:3000

# app (in another terminal)
cd app
cp .env.example .env      # point EXPO_PUBLIC_API_URL at the server
npm install
npx expo start
```

### Seeding occupation embeddings

`server/scripts/embed.mjs` embeds the SOC occupation list into MongoDB. It reads the same variables as the server:

```bash
cd server/scripts
node --env-file=../.env embed.mjs
```

## License

[MIT](LICENSE)
