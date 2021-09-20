
export function init(state, t) {
    return { state, n: 0, t: 0, count: 0, timer: 0, rest: 0 };
}

export function update({ state, PSI, standby, ready, go, prestep_fn, step_fn, stop_fn, start_fn, rest_freq=0, is_exit=false }) {
    // standby: wait until input is ready
    // ready: f ready for `ready` time steps, then transition into go
    // go: run for fixed `go` timesteps then transition into standby
    if (is_exit) {
      state.state == "exit"
    }
    console.log('t='+state.t+
      '|n='+state.n+'|count='+state.count+
      '|timer='+state.timer+'|state='+state.state)
    state.t += 1;
    if (state.state == "standby" || state.state == "ready") {
        state.timer += 1;
        prestep_fn(PSI);
        if (standby > 0 && state.timer >= standby) {
            state.state = "go";
            state.timer = 0;
            state.count = 0;
            state.t = 0;
            state.n += 1;
        }
    }
    if (state.state == "standby") {
        state.count = 0;
        if (start_fn(PSI)) {
            state.state = "ready";
        }
    }
    if (state.state == "ready") {
        if (start_fn(PSI)) {
            state.count += 1;
            if (state.count >= ready) {
                state.state = "go";
                state.count = 0
                state.timer = 0
                state.t = 0;
                state.n += 1;
            }
        } else {
            state.state = "standby";
            state.count = 0;
        }
    }
    if (state.state == "go") {
        state.count += 1;
        step_fn(PSI);
        //this.update()
        if (state.count >= go) {
            stop_fn();
            //this.stop()
            //this.init()
            state.rest += 1
            state.t = 0;
            state.timer = 0;
            if (rest_freq > 0 && state.rest >= rest_freq) {
                state.state = "rest"
                state.rest = 0
                state.timer = 0
            } else {
                state.state = "standby";
            }
        }
    }
    if (state.state == "rest" || state.state == "exit") {
      state.timer = 0
      state.t = 0
      state.count = 0
    }
    if (state.state == "resume") {
        state.timer = 0
        state.state = "standby"
    }

    return state;
}

export default { init, update }
