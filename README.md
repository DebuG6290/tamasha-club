# Tamasha Club

Cartoon party games for one shared screen and everyone's phones. Open the host screen on a laptop connected to a projector or TV; players scan its QR code or enter the four-letter room code. No app download or accounts.

Choose **Duck Pop** (tilt/touch aiming), **Gully Grand Prix** (three-lane racing), **Kaun Feku?** (spoken bluffing), or **Same Soch** (clues and spectrum guessing). Individual play is the default. Same Soch also has optional pair scoring. [Party rules](docs/PARTY_GAMES.md) · [Shooting, racing, motion controls and tournaments](docs/MOTION_AND_TOURNAMENTS.md).

Select **Tournament** in the lobby to choose a playlist and repeat count. Games award cup points by finishing place, with an overall winner after the playlist. Shooting/racing need 2–8 players; spoken party games need 4–8.

The earlier Terrace Tamasha, Rang Rumble and Auto Duo prototypes remain under **Earlier prototypes**. Demo players preview screens and scoring; they cannot replace real people speaking and interpreting clues. Optional tilt uses browser motion sensors over HTTPS, with a permission button where required and touch fallback. Actual gyro feel and haptics still need testing on physical iPhone/Android devices.

## Hosting the whole game (fewest steps)

Import this repository as a Node web service on Render. The included `render.yaml` also supports Blueprint setup.

- Node: **24**
- Build: `npm ci && npm run build`
- Start: `npm start`
- Health check: `/health`

Open the service's HTTPS URL on the projector laptop. That same URL serves the screens and the live room server; leave `VITE_API_BASE_URL` and `PUBLIC_ORIGINS` unset. Phones can join over the internet.

## Netlify screens + Node game server

Netlify hosts the screens. A running Node web service holds the shared rooms and moves.

1. Create the Node service above and copy its HTTPS URL.
2. Import this repository into Netlify. Build/publish settings are in `netlify.toml`.
3. Add Netlify environment variable `VITE_API_BASE_URL` = your Node service URL (no trailing slash), then deploy.
4. Add Node service environment variable `PUBLIC_ORIGINS` = your Netlify HTTPS URL. For multiple frontend domains, separate them with commas. Restart the Node service.
5. Open the Netlify URL on the projector laptop. Its QR codes point players to the same Netlify domain.

Set the Node service's `PUBLIC_ORIGINS` again if you change the Netlify/custom domain. Redeploy Netlify if the server URL changes. Do not put secrets in `VITE_` variables: they are public build settings.

**There is no database.** Active rooms, choices and scores live in server memory. Run one server instance; restarts, deployments or host sleep clear rooms. Free hosting can sleep when idle, so open the game before guests join. This is a prototype for small private groups, without production abuse controls or persistent history.

## Run locally

Use Node 24. Run `npm ci`, then `npm run dev`. For the production server, run `npm run build` followed by `npm start`.

`npm test` checks game rules, full simulated sessions, private choices, HTTP room joining and cross-domain access. Physical iPhone/Android controls, haptics, projector readability and online multi-device play still need playtesting.

Artwork is included under `public/assets`; font licenses are alongside their font files.
