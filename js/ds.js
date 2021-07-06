import registrar from '/js/ds/protocols/registrar.js'
import StandbyReadyGoFixedProtocol from '/js/ds/protocols/standby_ready_go_fixed.js'
import TaskController from '/js/ds/controller.js'
import SisoExperiment from '/js/ds/experiments/siso.js'
import ReftrackExperiment from '/js/ds/experiments/reftrack.js'

//import * as workerTimersBroker from '/js/dist/worker-timers-broker.js';
//import * as workerTimers from '/js/dist/worker-timers.js';

export default function DynamSpace({ update_fn, experiment } = {}) {
  
  let current, controller, study, task, space, upload_api;

  return { load, start, pause, resume, progress, getSpace, mount, save }

  function load(s, api) {
    study = s
    upload_api = api
  }

  function pause() {
    controller.pause()
  }

  function resume() {
    controller.resume()
  }

  function progress(sec=0) {
    return { 
      current: current, 
      total: study.tasks.length,
      time_remaining: sec*(study.tasks.length-current)/60
    }
  }

  function start( ){
    let Experiment;
    if (experiment == 'siso') {
      Experiment = SisoExperiment
    }
    else if (experiment == 'reftrack') {
      Experiment = ReftrackExperiment
    } else {
      console.log('Experiment ' + experiment + ' not supported')
    }

    controller = TaskController({
      protocol: StandbyReadyGoFixedProtocol,
      experiment: Experiment,
      registrar: registrar,
      done_fn: done,
      update_fn: update_fn,
      upload_fn: upload
    })
    current = 0
    task = study.tasks[current]
    controller.load(task)
    controller.start()
  }

  function getSpace() {
    return controller.getSpace()
  }

  function save() {
    controller.save()
  }

  function nextTask() {
    if (current >= study.tasks.length-1) {
      controller.exit()
    }
    current += 1
    task = study.tasks[current];
  }

  function mount(s, api) {
    study = s
    upload_api = api
    start()
  }

  function upload(object) {
    const payload = {
      sid: study.sid,
      ...object
    }
    const body = JSON.stringify(payload)
    console.log("uploading")
    fetch(upload_api, {
      method: 'post',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'mode': 'cors'
      },
      body 
    })
    .then( (res) => {
    });
  }

  function save() {
    controller.save()
  }

  function done() {
    nextTask()
  }
}



export function CreateMachine(object) {
  let { id, initial, context, states } = object;

  let destructors = [];
  let currentState = initial;
  let timer = new Worker('/js/timer.js')

  transitionTo(initial)

  return { currentState, send, transitionTo };

  function send(event) {
    console.log(states);
    console.log(currentState);
    if (states[currentState].on[event]) {
      transitionTo(states[currentState].on[event].target)
    }
  }


  function transition(state, action) {
    
  }

  function transitionTo(to) {
    if('onExit' in states[currentState]) {
      states[currentState].onExit();
    }
    destructors.forEach( d => d() )
    destructors = [];
    console.log('State transition to "'+to+'"')

    
    /* Entry */
    if('onEntry' in states[to]) {
      states[to].onEntry()
    }


    const state = states[to]

    /* setup listeners */
    if(state.on) {
      Object.keys(state.on).forEach((e) => {
        const ev = state.on[e];
        const target = ev.target
        if (e == 'CLICK') {
          // setup event listener for clicks
          const el = ev.el || window; 
          function onclick(e) { 
            transitionTo(target) 
          }
          el.addEventListener('click', onclick)
          destructors.push(() => el.removeEventListener('click', onclick))
        } else if (e == 'TIMER'){
          // setup timer for duration 
          const el = ev.el;
          context.elapsed = 0;
          let tick, timer;
          if(el) {
            timer = init_timer_graphic(el, 'timer123')
            tick = () => {
              context.elapsed += 50
              const p = context.elapsed/(ev.duration*1000)
              timer.update(p)
            }
            const _timer = window.setInterval(tick, 50)
            destructors.push(() => {timer.destroy(); window.clearInterval(_timer); console.log('destroyed timer')})
          }
          let timeout;

          timeout = function() {
            if (tick) { 
              window.clearInterval(tick)
              timer.destroy()
            }
            context.elapsed = 0
            transitionTo(target)
          }
          const _timeout = window.setTimeout(timeout, ev.duration*1000)
          destructors.push(() => { window.clearTimeout(_timeout) })
        }
      })
    }
    setScreen(states[to].screen)
    currentState = to;
  }

}


function setScreen(screen) {
  console.log('setScreen('+screen+')')
  const screens = document.querySelectorAll(".screen");
  screens.forEach( (v) => {
    if(screen.split(" ").includes(v.getAttribute("id"))) {
      v.classList.remove("hidden")
    } else {
      v.classList.add("hidden")
    }
  })
}

function init_timer_graphic(el, id) {
  el.innerHTML = `
  <svg overflow='visible' viewbox='0 0 11 11'>
    <path id="` + id + `" fill='black'/>
  </svg>
  `
  function update(val) {
    let timer = document.getElementById(id)
    if(!timer) return
    if (val>= 1) val = 0.99999999
    if (val<= -1) val = -0.9999999
    const x = -Math.sin(-val*Math.PI*2)*5+5
    const y = -Math.cos(-val*Math.PI*2)*5+5
    const xy = x + " " + y
    const large = 1-(val <= -0.5 || val >= 0.5)*1
    const sweep = 1-(val >= 0)*1
    const d = "M 5 5 M 5 0 A 5 5 0 "
    //d = "M 0 0 M 0-5 A 0 0 0 "
      + large + " " + sweep + " " + xy
      + " L 5 5 Z";
      //+ " L 0 0 Z";
    timer.setAttribute('d', d)
  }

  function destroy() { el.innerHTML = "" }

  return { update, destroy }
}


window.DynamSpace = DynamSpace
window.CreateMachine = CreateMachine
window.setScreen = setScreen
