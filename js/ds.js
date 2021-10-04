import registrar from '/js/ds/protocols/registrar.js'
import StandbyReadyGoFixedProtocol from '/js/ds/protocols/standby_ready_go_fixed.js'
import TaskController from '/js/ds/controller.js'
import SisoExperiment from '/js/ds/experiments/siso.js'
import ReftrackExperiment from '/js/ds/experiments/reftrack.js'

import ConjectureIteration from '/js/ds/protocols/conjectureiter.js'
import RevIteration from '/js/ds/protocols/reviter.js'

//import * as workerTimersBroker from '/js/dist/worker-timers-broker.js';
//import * as workerTimers from '/js/dist/worker-timers.js';

export default function DynamSpace({ update_fn, experiment, done_fn } = {}) {
  
  let count, controller, study, task, space, upload_api, session;
  let params;
  let min_left, random_permutation;

  let S_outer = { 
    t: 0, 
    k: 0.4,
    l: 0, 
  }
  let recieved_outer = { 
      0: false, 
      1: false
  }
  let I_outer = {
    cn:0,
    cp:0,
    xn:0,
    xp:0,
    yn:0,
    yp:0
  };

  let P_outer = {
    delta: 0.2,
    lr: 0.1,
  };

  let params_outer = {
    
  };

  function step_outer_loop(id, trial_dict) {
    console.log('step outer loop')
    if(study.outer_tasks.protocol == "reviter-1") {
      const costy = trial_dict.map(a => a.O.costy);
      const costy_median = math.median(costy);

      if (id == 0) {
        I_outer.cn = costy_median;
      } else if (id == 1) {
        I_outer.cp = costy_median;
      }
      recieved_outer[id] = true;

      console.log('reviter: '+id);
      console.log(task.params)
      console.log(costy_median);

      if (recieved_outer[0] && recieved_outer[1]) {
        console.log('TAKING A STEP')
        recieved_outer[0] = false;
        recieved_outer[1] = false;

        const next = RevIteration.step({ 
          P: P_outer, 
          S: S_outer, 
          I: I_outer 
        })
        console.log(next)

        S_outer = next.Sp;
        params_outer = { k: S_outer.k }
        console.log(params_outer)
      }
    }
    if(study.outer_tasks.protocol == "conjectureiter-1") {
      const x = trial_dict.map(a => a.S.x);
      const y = trial_dict.map(a => a.S.y);
      const x_median = math.median(x);
      const y_median = math.median(y);

      if (id == 0) {
        I_outer.xn = x_median;
        I_outer.yn = y_median;
      } else if (id == 1) {
        I_outer.xp = x_median;
        I_outer.yp = y_median;
      }
      recieved_outer[id] = true;

      console.log('conjectureiter: '+id);
      console.log(x_median);
      console.log(y_median);

      if (recieved_outer[0] && recieved_outer[1]) {
        console.log('TAKING A STEP')
        recieved_outer[0] = false;
        recieved_outer[1] = false;

        const next = ConjectureIteration.step({ 
          P: P_outer, 
          S: S_outer, 
          I: I_outer 
        })
        console.log('l:', next.Sp.l)

        S_outer = next.Sp;
        params_outer = { l: S_outer.l }
        console.log(params_outer)
      }
    }
  }

  return { load, start, pause, resume, progress, getSpace, mount, save }

  function load(s, api, sess={}, P={}) {
    study = s
    /* TODO REMOVE CODE: */
    study.outer_tasks = {
      protocol: s.protocol,
      params: s.params
    }

    upload_api = api
    count = 0
    session = sess;
    params = P
    random_permutation = _.shuffle(_.range(s.tasks.length));
    console.log(random_permutation);
    update_min_left()
  }

  function pause() {
    controller.pause()
  }

  function resume() {
    controller.resume()
  }

  function progress(sec=0) {
    update_min_left()
    const time_remaining = min_left || sec*(study.tasks.length-count)/60;
    return { 
      current: count, 
      total: study.tasks.length,
      time_remaining 
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
      done_fn: done_task,
      update_fn: update_fn,
      upload_fn: upload
    })
    task = study.tasks[count]
    controller.load(task, params)
    controller.start()
  }

  function getSpace() {
    return controller.getSpace()
  }

  function save() {
    controller.save()
  }
  function update_min_left() {
    min_left = 0
    for(let i=count; i<study.tasks.length; i++){
      min_left += study.tasks.length.duration || 0;
    }
    min_left /= 60;
  }

  function nextTask() {
    if (count >= study.tasks.length-1) {
      if (study.outer_tasks) {
        count = -1
      } else {
        controller.exit()
        done_fn();
      }
    }
    if(study.outer_tasks) {
      if (S_outer.t >= study.outer_tasks.params.num_iter) {
        controller.exit()
        done_fn();
      }
    } 
    count += 1;
    const idx = random_permutation[count];
    task = study.tasks[idx];
    update_min_left()

    if (task) {
      Object.assign(task.params, params)
      if(study.outer_tasks) {
        Object.assign(task.params, params_outer)
      }
      controller.reset(task)
    }
    else {
      console.log('Done trials')
      done_fn();
    }
  }

  function mount(s, api) {
    study = s
    upload_api = api
    start()
  }

  function upload(object) {
    console.log('upload')
    console.log('len='+object.data.length);
    let payload = {
      id: count,
      sid: study.sid,
      session,
      ...object
    }

    const body = JSON.stringify(payload)
    fetch(upload_api, {
      method: 'POST',
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

  function done_task(tid, trial_dict) {
    if(study.outer_tasks) {
      step_outer_loop(tid, trial_dict)
    }
    nextTask()
  }
}



export function CreateMachine(object) {
  let { id, initial, context, states } = object;

  let destructors = [];
  let currentState = initial;
  let timer = new Worker('/js/timer.js')

  transitionTo(initial)

  return { currentState, send, transitionTo, getCurrentState };

  function getCurrentState() {
    return currentState;
  }

  function send(event) {
    if (states[currentState].on[event]) {
      transitionTo(states[currentState].on[event].target)
    }
  }


  function transition(state, action) {
    const s = states[state]

    if(state != currentState) {
      console.log('error: state ('+state+') does not match current state ('+currentState+')');
    }
    /* setup event listeners */
    if (action in s.on) {
      transitionTo(s.on[action].target)
    } else {
      console.log('invalid transition ('+action+')');
    }
  }

  function parseOnEvent(state, e) {
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
        destructors.push(() => {
          timer.destroy(); 
          window.clearInterval(_timer); 
          })
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
    } else if (e == 'FETCH'){
      //setup fetch
      console.log('fetching')
      fetch(ev.url)
      .then(function(response){
        console.log('fetched')
        if (!response.ok) {
          throw new Error('HTTP error, status = ' + response.status);
        } 
        transitionTo(target)
        return response.json()
      })
      .then(function(json) {
        context[ev.json] = json
        transition(target, 'RESOLVE')
      })
      .catch(function(error) {
        console.log(error)
        transitionTo(target)
        transition(target, 'REJECT')
      })
    } else if (e == 'SUBMIT') {
      const send = function () {
        console.log('submitting')
        const fd = new FormData(ev.form);
        let payload = {}
        if(ev.payload){
          payload = {...payload, ...ev.payload}
        }
          
        const body = JSON.stringify({...payload, data: Object.fromEntries(fd)})
        fetch(ev.url, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'mode': 'cors'
          },
          body
        }).then(res => res.json())
        .then(json => console.log(json))
        .catch(err=> console.error(err));
      }
      if(ev.throttle) {
        const throttled = _.throttle(send, ev.throttle)
        ev.form.addEventListener('keyup', throttled)
        destructors.push(function() {
          ev.form.removeEventListener('keyup', throttled)
        })
      } else {
        destructors.push(send)
      }
    } else if (e == 'REDIRECT') {
      console.log('redirect')
      const href = ev.url(context) || '#';
      ev.link.setAttribute('href', href);
      if(context.completion_code) {
        ev.code.innerHTML = context.completion_code
        window.location.replace(ev.url(context));
      }
    }
  }

  function transitionTo(to) {
    const prevState = currentState;
    currentState = to;
    console.log('transitionTo('+to+')')
    setScreen(states[to].screen)
    if('onExit' in states[prevState]) {
      states[prevState].onExit();
    }
    const des = destructors;
    destructors = [];
    des.forEach( d => d() )
    
    /* Entry */
    if('onEntry' in states[to]) {
      states[to].onEntry(context)
    }

    const state = states[to]

    /* setup event listeners */
    if(state.on) {
      Object.keys(state.on).forEach((e)=>parseOnEvent(state,e))
    }

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
    <path id="` + id + `" d="M 5 5 M 5 0 A 5 5 0 1 0 5 0 L 5 5 Z" fill='black'/>
  </svg>
  `
  function update(val) {
    let timer = document.getElementById(id)
    if(!timer) return
    if (val>= 1) val = 0.99999999
    if (val<= -1) val = -0.9999999
    val = val-1;
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
