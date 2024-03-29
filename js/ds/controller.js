import { log, init_zip, zip, save_zip, zip_add_file } from '/js/ds/analysis/utils.js'
//import SampleStudy from '/js/protocols/sample_study.json'
import quadgame from '/js/ds/environments/quadgame.js'
import graddescent from '/js/ds/environments/graddescent.js'
import reftrack from '/js/ds/environments/reftrack.js'

/**
 * Creates an experiment that operates according to the passed in functions and parameters, and returns
 * the collected data.
 *
 *
 * @param {*} experiment
 * @param {*} protocol
 * @param {*} registrar
 * @param {*} done_fn
 * @param {*} update_fn
 */

export default function TaskController({ 
    experiment, 
    protocol, 
    registrar, 
    done_fn,
    update_fn,
    is_save_zip = true,
    upload_fn
 }) {
  let { init, update } = protocol
  let { mount, draw, destroy, start_condition } = experiment

  let state = {
    P: {}, S: {}, I: {}, O: {},  //space
    canvas: null, 
    state: { state: null },
    registrar,
    zip: null, trial: [],
    reset_fn: null,
    step_fn: null,
    freq: 40,
    duration: 30,
    ready_wait: 2,
    is_exit: false
  };

  return {
    start,
    load, 
    reset, 
    pause,
    resume,
    //step, 
    save,
    exit,
    getSpace,
    //status, 
    // getState: ()=>state
    };
  function start() {
    console.log('Controller: start')
    console.log('params: ')
    console.log(state.task)
    state.state = init('standby', 0)
    state.zip = init_zip()
    state.zip
    //zip_add_file(state.zip, 'study.json', JSON.stringify(SampleStudy))
    zip_add_file(state.zip, 'protocols.json', JSON.stringify(state.registrar))
    reset(state.task)
    tick()
  }

  function getSpace() {
    return {P: state.P, S: state.S, I: state.I, O: state.O}
  }

  function setInput(I) {
    state.I = I
  }

  function reset(task) {
    console.log('Controller: reset')
    if ( task == null ) {
      console.log("Warning: task initialized to null")
    }
    // TODO: fix done state
    state.task = task
    const protocol = task.protocol
    const params = task.params
    const proto = registrar[protocol]

    console.log(task.params.duration)
    // Initialize a trial
    state.freq = proto.freq
    state.duration = task.params.duration || proto.duration;
    state.ready_wait = proto.ready_wait
    state.standby_wait = proto.standby_wait
    state.rest_wait = 10
    state.rest_freq = 3
    // state.canvas.width = proto.preset.k.w
    // state.canvas.height = proto.preset.k.h

    if (proto.env == 'graddescent') {
      state.step_fn = graddescent.step
      state.reset_fn = graddescent.reset
    } else if (proto.env == 'quadgame') {
      state.step_fn = quadgame.step
      state.reset_fn = quadgame.reset
    } else if (proto.env == 'reftrack') {
      state.step_fn = reftrack.step
      state.reset_fn = reftrack.reset
    } else {
      return false
    }
    

    let PP = {...proto.preset, ...params}

    let { P, S, I, O } = state.reset_fn({ P:PP })
    state.P = P
    state.S = S
    state.I = I
    state.O = O
    state.trial = []
    state.trial_dict = []
    state.pretrial_dict = []

    return true
  }

  function load(task, params={}){
    console.log("loading")
    Object.assign(task.params, params);
    state.task = task
    mount({ getSpace, setInput, update_fn })
  }

  /* old funciton: */
  function mount_canvas({ canvas, task } ) {
    if (canvas == null) {
      console.log('Warning: canvas initialized to null')
    }
    state.task = task
    state.canvas = canvas
    mount({
      canvas: canvas, 
      set_I: (I)=>state.I=I, 
      get_P: ()=>state.P,
      set_P: (P)=>state.P=P, 
      })
    start()
  }

  function step(PSI) {
      // Step
      const { P, S, I } = PSI;

      let { Sp, O } = state.step_fn({ P, S, I })
      state.O = O

      // Log
      const data = { 
        t: { 
          t:state.state.t, 
          utc:Date.now() 
        } , 
        S: state.S, 
        I: state.I, 
        O: state.O
      }
      state.trial_dict.push(data)

      let json = log(data)
      state.trial.push(json)

      // Update to next state
      state.S = Sp
  }

  function prestep(PSI) {
      const { P, S, I } = PSI;

      // Log
      const data = { 
        t: { 
          t:state.state.t, 
          utc:Date.now() 
        } , 
        I: state.I, 
      }
      state.pretrial_dict.push(data)
  }

  function stop() {
      console.log('Controller: stopped')
      const filename = state.task.id + '-' + state.task.protocol + '-P' + JSON.stringify(state.P).replace(/[^\w\s.]/gi, '')+ '.csv'
      if(is_save_zip) {
        zip(state.zip, filename, state.trial)
      }
      const trial_dict = JSON.parse(JSON.stringify(state.trial_dict));
      const pretrial_dict = JSON.parse(JSON.stringify(state.pretrial_dict));
      const P = state.P;
      if(upload_fn) {
        upload_fn({
          protocol: state.task.protocol + '-pre', 
          id: state.task.id, 
          params: P,
          data: pretrial_dict,
        })
        upload_fn({
          protocol: state.task.protocol, 
          id: state.task.id, 
          params: P,
          data: trial_dict,
        })
      }

      done_fn()
  }

  function save() {
    function appendZero(x) {
      if (x < 10) {
        return '0' + x
      }
    }
    const d = new Date();
    const date = ''+ d.getFullYear() + appendZero(d.getMonth() + 1) + appendZero(d.getDate());
    const name = prompt('Enter your name or unique ID (if provided):', 'anonymous')
    save_zip(state.zip, 'DS01-' + date + '-' + name + '.zip')
  }

  function pause() {
    state.state.state = 'rest'
  }

  function resume() {
    state.state.state = 'resume'
  }

  function exit() {
    console.log('Controller: exit')
    state.is_exit = true
  }

  function tick() {
    state.state = update({
      PSI: { 
        P: state.P, 
        S: state.S, 
        I: state.I 
      },
      state: state.state, 
      start_fn: start_condition,
      prestep_fn: prestep,
      step_fn: step, 
      stop_fn: stop,
      standby: state.freq*state.standby_wait,
      ready: state.freq*state.ready_wait,
      go: state.freq*state.duration,
      rest: state.freq*state.rest_wait,
      rest_freq: state.rest_freq,
      is_exit: state.is_exit
    })
    const PSIO = { P: state.P, S: state.S, I: state.I, O: state.O }
    if(state.canvas) {
      const ctx = state.canvas.getContext('2d')
      draw(PSIO)(ctx)
    } else {
      draw(PSIO)
    }
    if (state.is_exit) {
      state.state.state='exit'
    }
    update_fn({msg:status(), state:state.state.state})
    if (state.is_exit) {
      return
    }
    window.setTimeout(tick, 1000/state.freq)

  }

  function status() {
    const ready = state.ready_wait - state.state.count/state.freq
    const go = state.duration - state.state.count/state.freq
    switch(state.state.state) {
        case 'ready':
            return "Ready in " + Math.ceil(ready)
        case 'go':
            return "Go! (" +  Math.ceil(go)  +"s remaining)"
        default:
            return " "
    }
  }
}

