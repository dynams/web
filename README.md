# dynam.space
A dynamics simulator and data collector. 

[https//dynam.space](https://dynam.space/) 

## Instructions
Load static website:
```
cd web
livereload
```

## n×m games
`docs/nxmgame-design.md` designs and implements the three co-adaptation
experiments (gradient play, conjecture estimation, policy gradient) for
games where the human's action is n-dimensional and controlled through a
2D mouse. Try it: serve the repo and open `demo/nxmgame.html` (interactive
demo with equilibria meters) or `study/nxmgame.html` (full study flow).
Run the test suite (game math, experiments-in-simulation, input-mapping
controllability battery) with:
```
npm test
```
