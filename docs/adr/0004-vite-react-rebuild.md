# Rebuild as a Vite + React + TypeScript app

v1.0 was a single hand-written `index.html` that could be hosted anywhere with no build. The provider rework and redesign touch nearly every line, so we rebuild with Vite, React, TypeScript and Tailwind: the pipeline gets tests, dialogs and menus get accessible primitives, and errors stop using `alert()`. The output is still a static site served by GitHub Pages; the only new moving part is a build step in GitHub Actions.
