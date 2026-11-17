# Better GitHub Explore

A personal discovery feed for GitHub, ranked by what you've starred.

It reads your most recent stars, builds a weighted taste profile (topics, languages, keywords; recent stars count more), searches GitHub for fresh repos in those areas, and ranks them by fit and momentum (stars per day). Spam clones, archived repos, your own repos and unpopular forks are filtered out.

## Run

Needs Node 20+ and a GitHub login (`gh auth login`) or a `GITHUB_TOKEN`.

```sh
npm start        # http://localhost:4321
npm test
```

The server listens on localhost only and refreshes the feed every 6 hours. State (dismissed repos, "seen" marker) is kept in `data/state.json`.

## Settings (environment variables)

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4321` | Port to listen on |
| `STAR_LIMIT` | `1000` | How many recent stars to learn from |
| `REFRESH_HOURS` | `6` | Hours between automatic refreshes |
| `FORK_MIN_STARS` | `200` | Forks below this are hidden |
