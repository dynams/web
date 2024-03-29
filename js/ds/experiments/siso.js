// Defines inputs and drawing functionality
//
// Interfaces with a SVG graphics to draw
// the input, states and outputs of the experiment

import { center_origin } from "/js/ds/experiments/utils.js";

const input = document.getElementById('input')
const output = document.getElementById('output')
const target = document.getElementById('target')

export function start_condition({ P, S, I }) {
    return Math.abs(S.x - I.x) < P.tol;
}

export function mount({ getSpace, setInput, update_fn }) {
  function move(x,y) {
    x = x/window.innerWidth*2-1
    y = y/window.innerHeight*2-1
    setInput({x, y})
    update_fn()
    drawInput(x)
  }

  function mousemove(e) {
    move(e.clientX, e.clientY)
  }

  function touchmove(e) {
    move(e.touches[0].clientX, e.touches[0].clientY)
  }

  window.addEventListener("mousemove", mousemove);
  window.addEventListener("touchmove", touchmove);
}

export function destroy({ canvas }) {
    canvas.removeEventListener("mousemove")
}

export function draw({ P, S, I, O }) {
  drawOutput({ P, O })
  drawTarget({ S })
}

function drawInput(x) {
  x = (x+1)/2*100;
  input.setAttribute('x', x+'%')
  input.setAttribute('transform-origin', x+'% 85%')
}

function drawOutput({ P, O }) {
  const bot = 80
  const mid = 70
  const tot = 10

  let val = Math.sqrt(O.cost);
  if ( val > 0.5) {
    val = Math.atan(Math.PI*(val-0.5))/Math.PI + 1/2
  }
    

  const h = val*(mid-tot) +bot-mid
  const y = (1-val) * (mid-tot) + tot

  output.setAttribute('height', h+'%')
  output.setAttribute('y', y+'%')
}

function drawTarget({ S }) {
  let x = S.x;
  x = (x+1)/2*100

  target.setAttribute('x', x+'%')
  target.setAttribute('transform-origin', x+'% 85%')
}

export default { mount, destroy, start_condition, draw }
