
export function init(state, t) {
    return { state, n: 0, t: 0, count: 0, timer: 0, rest: 0 };
}

export function update({ state, PSI, standby, ready, go, rest, rest_freq, step_fn, stop_fn, start_fn }) {
    // standby: wait until input is ready
    // ready: f ready for `ready` time steps, then transition into go
    // go: run for fixed `go` timesteps then transition into standby
    state.t += 1;
    if (state.state == "standby") {
        state.timer += 1
        if (start_fn(PSI)) {
            state.state = "ready";
            state.count = 0;
        }
    }
    if (state.state == "ready") {
        state.timer += 1
        if (start_fn(PSI)) {
            state.count += 1;
            if (state.count >= ready) {
                state.state = "go";
                state.count = 0
                state.t = 0;
                state.n += 1;
            }
        } else {
            state.state = "standby";
            state.count = 0;
        }
    }
    if (state.state == "standby" || state.state == "ready") {
        if (state.timer >= standby) {
            state.state = "go";
            state.timer = 0;
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
            if (state.rest >= rest_freq) {
                state.state = "rest"
                state.rest = 0
                state.timer = 0
            } else {
                state.state = "standby";
            }
        }
    }
    if (state.state == "rest") {
        state.timer += 1
        if (state.timer >= rest) {
            state.state = "standby"
            state.timer = 0
        }
    }
    return state;
}

export default { init, update }
