export function random_uniform(min, max) {
    return Math.random()*(max-min)+min
}
export function random_uniform_int(mean, plus_minus) {
    return Math.round(random_uniform(mean, plus_minus));
}
