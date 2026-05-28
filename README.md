# UC News

A simple news app with a Node.js backend proxy for GNews API caching.

## Features

- Frontend served from the same server
- Backend proxies GNews requests
- Caches news responses in `cache.json`
- Keeps API key hidden in `.env`

## Local setup

1. Install dependencies:
   ```bash
   cd "c:\jv news"
   npm install
   ```

2. Create `.env` from `.env.example` and add your GNews key:
   ```env
   GNEWS_API_KEY=YOUR_GNEWS_API_KEY_HERE
   CACHE_TTL_SECONDS=600
   PORT=3000
   ```

3. Start the app:
   ```bash
   npm start
   ```

4. Open in browser:
   ```text
   http://localhost:3000
   ```

## Publish options

### Railway

1. Create a Railway project.
2. Connect the GitHub repo or upload this folder.
3. Set environment variables in Railway:
   - `GNEWS_API_KEY`
   - `CACHE_TTL_SECONDS=600`
   - `PORT=3000`
4. Deploy.

### Render

1. Create a new Web Service.
2. Point to this repo or upload the code.
3. Set env vars:
   - `GNEWS_API_KEY`
   - `CACHE_TTL_SECONDS=600`
   - `PORT=3000`
4. Deploy.

### Heroku

1. Create a Heroku app.
2. Push this repo to Heroku.
3. Set config vars:
   - `GNEWS_API_KEY`
   - `CACHE_TTL_SECONDS=600`
   - `PORT=3000`
4. Heroku will use `Procfile` to run `node server.js`.

## Notes

- Make sure you do not publish `.env` or `cache.json`.
- The backend caches requests, so repeated page loads use fewer GNews API calls.
- If the app fails to load, check the console and backend logs on the hosting platform.
