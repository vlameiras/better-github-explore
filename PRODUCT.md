# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One user: the owner, a developer who stars a lot of GitHub repositories. It is a personal tool. A hosted copy on GitHub Pages lets anyone enter a GitHub username and get the same feed for that account's public stars, but the owner's daily use is the design target.

The job: find out, in a minute or two, whether anything worth starring has turned up in the areas they care about since they last looked.

## Product Purpose

Better Explore replaces GitHub's generic Explore and Trending pages with a feed ranked by the owner's own stars. It reads their most recent stars (1,000 by default), builds a weighted taste profile of topics, languages and keywords where recent stars count more (180-day half-life), searches GitHub for fresh repos in those areas, and ranks them by fit and momentum.

Success means each visit surfaces a few repos the owner actually opens or stars, with little to scroll past. A quiet day with nothing relevant is an acceptable result. Filling the feed with weak matches is not.

## Positioning

The ranking comes from the owner's own star history, not from global popularity. Every pick shows why it is there ("Because you follow …", "you star a lot of …", "like … and …"). Noise that public discovery pages tolerate is filtered out: spam and clone clusters, archived repos, the owner's own repos, and forks below a star threshold.

## Operating Context

- **Daily skim.** The owner opens the tab about once a day, checks **New** (created in the last 48 hours), opens or stars a few repos, dismisses the rest, and leaves. **This week** (last 7 days), topic and language facets, text filter and sort are secondary.
- Two modes, one static page in `public/`. Hosted (GitHub Pages): the visitor enters a handle and the browser calls GitHub's public API with no token, so a refresh takes a couple of minutes and starring links out to GitHub. Local (`npm start`, `localhost:4321`): the server proxies GitHub with the owner's token, so private stars and starring work and a refresh takes under a minute.
- The feed refreshes in the browser when the page is opened or shown and is older than 6 hours. A manual Refresh is available. Picks appear while the first refresh is still running.
- Authentication uses the GitHub CLI login (`gh auth login`) or `GITHUB_TOKEN`. Starring from the feed writes a real star to the owner's GitHub account.

## Capabilities and Constraints

- Views: For you, New (with a count), This week, Dismissed.
- Sorting: Recommended (score: fit blended with momentum), Best match (the % match shown on cards), Fastest rising (stars per day), Newest.
- Each card shows the owner avatar, name, New and Fork badges, a match percentage, the description, the "Because …" reasons, up to 8 topic chips (matched topics highlighted), stars, stars per day, language and repo age.
- Actions: Star or unstar (writes to GitHub), "Not interested" / Restore, both with undo in a toast. Topic chips and the taste-profile bars work as one-at-a-time facet filters.
- A taste-profile sidebar shows the learned topics (top 14) and languages (top 6) as weighted bars.
- State (feed, dismissed repos, the time of the last visit) lives in the browser's `localStorage`, one entry per account. No accounts or backend storage.
- Stack: vanilla HTML/CSS/JS in `public/` (ES modules, no build step), deployable as a static site. Node 20+ with no runtime dependencies for the local proxy server. Tests use `node --test`.
- Settings are environment variables: `PORT`, `STAR_LIMIT`, `REFRESH_HOURS`, `FORK_MIN_STARS`.

## Brand Commitments

- The app is called "Better Explore" in the UI and "Better GitHub Explore" in the README. The mark is a `◆` glyph.
- Voice: plain, short and first-person-adjacent ("you follow …", "Not interested", "Nothing created in the last 48 hours matches your taste yet").

## Evidence on Hand

- `docs/screenshot.png`, a real capture of the feed, used in the README.
- There are no other users, testimonials or metrics. Do not invent any.

## Product Principles

1. **Fewer, better picks.** Precision beats volume. Showing nothing is better than showing noise.
2. **Built for a two-minute skim.** What's new and why it matters should be readable at a glance, with acting or moving on one click away.
3. **Every pick explains itself.** The reason a repo is here stays visible so the owner can trust the ranking or correct it.
4. **Reversible and honest.** Dismissals and stars can be undone. Real GitHub writes are clearly labelled. Errors and stale data are stated plainly.
5. **Personal, not public.** Design for one known user's taste and routine, not for an audience or for growth.
