const canvas = document.getElementById('canvas')
const inputmode_radio = document.getElementsByName('inputmode')

let buff = {r:[], t:0}
const freqs = [2, 3, 5, 7, 11, 13, 17, 19]
//freqs = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]
let amp1 = []
freqs.forEach((f, index) => {
  // working on this part - not sure if this is right equation
  amp1[index] = (.5/f)
});

const sum1 = amp1.reduce(function(a, b){
  return a + b;
}, 0);

let amp = []
freqs.forEach((f, index) => {
  amp[index] = (1./f)*sum1*200
});

const GOLD = 'rgb(241,163,64)'
const PURPLE = 'rgb(153,142,195)'
const BLACK = 'rgb(0,0,0)'

function reference(time, P) {
  time = time - P.shift
  let x = 0
  if (time < 0) return 0
  // ramp
  const weight = (0<time)*(time<P.ramp)*(time/P.ramp) + (time>=P.ramp)
  let index=0;
  freqs.forEach((f) => {
    x += weight*Math.sin(time*f/P.scale)*amp[index]
    index++
  })
  return x
}

function init_reference(time, n, P) {
  let t = new Array(n).fill(1).map((e,i)=>i)
  const y = t.map((t)=>reference(time + t - n/2, P))
  return y
}

export function start_condition({ P, S, I }) {
    return Math.abs(I.x) < 0.03;
}

function mount({ getSpace, setInput, update_fn }) {
  const ctx = canvas.getContext('2d');
  let ws = null
  const { S, I } = getSpace()

  let inputmode = I.mode
  function changeInputMode(e) {
    inputmode = getCheckedValue(inputmode_radio)
    if (inputmode == 'slider') {
      window.removeEventListener('mousemove', mouseMove)
      window.removeEventListener('touchmove', touchMove)
      setInput({x:0, mode:'slider'})
      ws = connect(getUrl(), setInput)
      printStatus('connecting...')
    } else if (inputmode == 'cursor') {
      if(ws) ws.close()
      window.addEventListener('mousemove', mouseMove, false);
      window.addEventListener('touchmove', touchMove, false);
    }
  }
  changeInputMode()
  inputmode_radio[0].addEventListener('change', changeInputMode, false);
  inputmode_radio[1].addEventListener('change', changeInputMode, false);
  window.addEventListener('resize', resizeCanvas, false);
  resizeCanvas();

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const S = getSpace().S
    buff.r = init_reference(S.t, canvas.height, getSpace().P)
    buff.t = S.t
  }

  function mouseMove() {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    setInput({x: 2*x/canvas.width-1, mode: 'mouse'})
    update_fn()
  }

  function touchMove() {
    const rect = canvas.getBoundingClientRect();
    const x = event.touches[0].clientX - rect.left;
    setInput({x: 2*x/canvas.width-1, mode: 'touch'})
    update_fn()
  }

}


function draw({ P, S, I }) {
  buff.r[(S.t-buff.t-1) % buff.r.length] = reference(S.t + canvas.height/2, P)

  let ctx = canvas.getContext('2d');
  const h = canvas.height;
  reset_draw(ctx, canvas.width, h)

  ctx.lineWidth = 10;
  ctx.strokeStyle = GOLD
  ctx.fillStyle = PURPLE
  ctx.lineCap = 'square';

  ctx.beginPath();
  const start_t = (S.t - buff.t) % buff.r.length
  ctx.moveTo(buff.r[start_t],h/2)
  for(let i=0; i < buff.r.length; i++) {
    const x = buff.r[(i+start_t)%buff.r.length]
    ctx.lineTo(x, h/2-i)
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(S.x1, 0, 8, 0, 2*Math.PI)
  ctx.fill()
}

function reset_draw(ctx, w, h){
  ctx.resetTransform();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BLACK
  ctx.fillRect(0, 0, w, h);
  ctx.transform(1, 0, 0, 1, w / 2, h / 2);
}

function getCheckedValue(radioObj) {
  if(!radioObj) return "";
  var radioLength = radioObj.length;
  if(radioLength == undefined)
    if(radioObj.checked)
      return radioObj.value;
    else
      return "";
  for(var i = 0; i < radioLength; i++) { 
    if(radioObj[i].checked) {
      return radioObj[i].value;
    }
  }
  return "";
}
function setCheckedValue(radioObj, newValue) {
  if(!radioObj) return;
  var radioLength = radioObj.length;
  if(radioLength == undefined) {
    radioObj.checked = (radioObj.value == newValue.toString());
    return;
  }
  for(var i = 0; i < radioLength; i++) {
    radioObj[i].checked = false;
    if(radioObj[i].value == newValue.toString()) {
      radioObj[i].checked = true;
    }
  }
}

function connect(url, setInput) {
  var ws = new WebSocket(url);
  ws.onopen = function() {
    // subscribe to some channels
    printStatus('connected')
    ws.send(JSON.stringify({ }));
  };

  ws.onmessage = function(e) {
    const data = JSON.parse(e.data)
    const inputmode = getCheckedValue(inputmode_radio)
    if(inputmode == 'slider') {
      setInput({x: data.I.x, mode: 'slider'})
    }
  };

  ws.onclose = function(e) {
    printStatus('disconnected. ')
    window.setTimeout(function() {
      connect(url, setInput);
    }, 1000);
  };

  ws.onerror = function(err) {
    console.error('Socket encountered error: ', err.message, 'Closing socket');
    ws.close();
  };
  return ws
}

export default { mount, start_condition, draw }
