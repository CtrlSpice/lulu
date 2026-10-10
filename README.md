# Lulu pixel lab

Pixel-art Lulu (and later Lulu's dad), drawn as letter grids: palette lines (`o=#7e3a5c`) followed by one line of letters per pixel row, `.` for empty.

## Start

```
node tools/serve.mjs "$PWD"
```

Then open in the browser pane:

- Editor (front, side, back): http://127.0.0.1:4789/views.html
- Progress graph: http://127.0.0.1:4789/history/graph.html

The editor paints in memory only. Claude reads the paint from the page and writes it into `views/*.txt`; reloading the page before that throws the paint away.

## Where things live

- `views/front.txt`, `views/side.txt`, `views/back.txt`: the current Lulu.
- `checkpoints/`: numbered save points (`20-freckle-fix/` and so on).
- `versions/`: the version before every change, for undo.
- `history/steps.js`: the progress graph data. One row per decision, oldest first; add new rows at the end. `K` = kept, `X` = rejected, `P` = just playing, `['tool', name, note]` = a new tool.
- `characters/lulus-dad/`: ideas saved for Lulu's dad.
- `tools/`: the local server, PNG renderers and the graph page builder.

## Publish the graph

```
node tools/build-graph-page.mjs
```

This writes `history/lulu-warts-and-all.html` with all the art embedded; Claude republishes it to the same Artifact link (https://claude.ai/artifact/9Ub2sUQi7PmnzUS2gpV8Qz).
