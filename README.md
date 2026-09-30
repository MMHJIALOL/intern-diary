# Internship diary

- `report.tex` / `report.pdf`: internship report (build with `pdflatex report.tex`); figures in `figures/`.
- `combiner_film/`, `compare_film/`, `coverage_film/`: explainer motion graphics for the report's tools. Each is a `film.html` whose frames are a pure function `seek(t)`, rendered with `node render.js`, cut and pop-scanned with `node post.js`. Finished videos are in `*/out/film.mp4`.
- `IMG_57xx.HEIC`: diary photos.

The film engine is packaged as a reusable Claude Code skill: [seek-film](https://github.com/MMHJIALOL/seek-film).
