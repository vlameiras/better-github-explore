# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One user: the owner, a developer who stars a lot of GitHub repositories. It is a personal tool, not built for other people to run or for a hosted audience. Anyone else only sees it through the README and its screenshot.

The job: find out, in a minute or two, whether anything worth starring has turned up in the areas they care about since they last looked.

## Product Purpose

Better Explore replaces GitHub's generic Explore and Trending pages with a feed ranked by the owner's own stars. It reads their most recent stars (1,000 by default), builds a weighted taste profile of topics, languages and keywords where recent stars count more (180-day half-life), searches GitHub for fresh repos in those areas, and ranks them by fit and momentum.

Success means each visit surfaces a few repos the owner actually opens or stars, with little to scroll past. A quiet day with nothing relevant is an acceptable result. Filling the feed with weak matches is not.

## Positioning

The ranking comes from the owner's own star history, not from global popularity. Every pick shows why it is there ("Because you follow …", "you star a lot of …", "like … and …"). Noise that public discovery pages tolerate is filtered out: spam and clone clusters, archived repos, the owner's own repos, and forks below a star threshold.

## Operating Context

- **Daily skim.** The owner opens the tab about once a day, checks **New** (created in the last 48 hours), opens or stars a few repos, dismisses the rest, and leaves. **This week** (last 7 days), topic and language facets, text filter and sort are secondary.
- The server runs locally (`npm start`, `localhost:4321`) and refreshes on its own every 6 hours. Coming back to the tab picks up a background refresh. A manual Refresh is available.
- Authentication uses the GitHub CLI login (`gh auth login`) or `GITHUB_TOKEN`. Starring from the feed writes a real star to the owner's GitHub account.

## Capabilities and Constraints

- Views: For you, New (with a count), This week, Dismissed.
- Sorting: Best match (score), Fastest rising (stars per day), Newest.
- Each card shows the owner avatar, name, New and Fork badges, a match percentage, the description, the "Because …" reasons, up to 8 topic chips (matched topics highlighted), stars, stars per day, language and repo age.
- Actions: Star or unstar (writes to GitHub), "Not interested" / Restore, both with undo in a toast. Topic chips and the taste-profile bars work as one-at-a-time facet filters.
- A taste-profile sidebar shows the learned topics (top 14) and languages (top 6) as weighted bars.
- State (dismissed repos, the time of the last visit) lives in `data/state.json`. Localhost only, single user, no accounts.
- Stack: Node 20+ with no runtime dependencies, plain `http` server, vanilla HTML/CSS/JS in `public/`, no build step. Tests use `node --test`.
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
