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
  };

  return {
    start,
    load, 
    reset, 
    //step, 
    save,
    getSpace,
    //status, 
    // getState: ()=>state
    };
  function start() {
    console.log('Started')
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
    if ( task == null ) {
      console.log("Warning: task initialized to null")
    }
    state.task = task
    const protocol = task.protocol
    if (protocol == 'welcome' || protocol == 'break') {
      console.log('go to break')
      return false
    }

    const params = task.params
    const proto = registrar[protocol]

    // Initialize a trial
    state.freq = proto.freq
    state.duration = proto.duration
    state.ready_wait = proto.ready_wait
    state.standby_wait = proto.standby_wait
    state.rest_wait = 10
    state.rest_freq = 1
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
    } 
    

    let PP = {...proto.preset, ...params}
    //PP.k = PP.k || {}
    //PP.k.w = window.innerWidth;
    //PP.k.h = window.innerHeight;

    let { P, S, I, O} = state.reset_fn({ P:PP })
    state.P = P
    state.S = S
    state.I = I
    state.O = O
    state.trial = []
    state.trial_dict = []

    return true

  }

  function load(task){
    console.log("loading")
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
      const { Sp, O } = state.step_fn(PSI)
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

  function stop() {
      const filename = state.task.id + '-' + state.task.protocol + '-P' + JSON.stringify(state.P).replace(/[^\w\s.]/gi, '')+ '.csv'
      if(is_save_zip) {
        zip(state.zip, filename, state.trial)
      }
      if(upload_fn) {
        upload_fn({
          protocol: state.task.protocol, 
          id: state.task.id, 
          params: state.P, 
          data: state.trial_dict
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

  function resume() {
    state.state.state = 'resume'
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
      step_fn: step, 
      stop_fn: stop,
      standby: state.freq*state.standby_wait,
      ready: state.freq*state.ready_wait,
      go: state.freq*state.duration,
      rest: state.freq*state.rest_wait,
      rest_freq: state.rest_freq
    })
    const PSIO = { P: state.P, S: state.S, I: state.I, O: state.O }
    if(state.canvas) {
      const ctx = state.canvas.getContext('2d')
      draw(PSIO)(ctx)
    } else {
      draw(PSIO)
    }
    window.setTimeout(tick, 1000/state.freq)

    update_fn({msg:status(), state:state.state.state})
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

