# Grid mode

Press <kbd>g</kbd>, or use **Grid** in the toolbar.

The explorer shows one fixture at a time, which is the right answer to "what does this
look like" and the wrong answer to "what do we have". Grid mode is the second question:
every fixture in the tree at once, as a contact sheet. Clicking a tile selects that
fixture and returns you to the single view.

Search narrows the grid exactly as it narrows the tree, so `g` after typing `button` is a
sheet of every button state in the project.

## What it costs

Each tile is its own frame. That is the same isolation a single preview gets: forty
fixtures sharing one document would share global listeners, `document.body` and any CSS
one of them injects, and the tile that broke the grid would be indistinguishable from the
tile that broke its neighbour.

Frames are not free, so:

- a tile renders when it scrolls near the viewport, and not before;
- at most **30** tiles hold a live frame at once;
- past that, tiles show their name and a **Render anyway** button.

So pressing <kbd>g</kbd> on a corpus of six hundred fixtures gives you a readable list
rather than six hundred iframes and a stalled tab. Nothing renders in bulk without being
asked — the same rule the tree follows.

## Related

Selecting a _file_ rather than one of its fixtures already renders every fixture in that
file, stacked, with a heading each. That is the per-file version of the same idea and
needs no key.

Grid mode requires frame isolation, so it is unavailable on a mount using
`isolation="inline"` — inline has one realm by definition.
