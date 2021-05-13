
export function start_condition({ P, S, I }) {
    return Math.abs(S.x1) < P.tol;
}

export function mount({ getSpace, setInput, update_fn }) {

}

export function draw() {

}

export default { mount, start_condition, draw }
