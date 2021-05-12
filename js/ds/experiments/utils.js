export function center_origin(w, h) {
    return function(ctx) {
        ctx.resetTransform();
        ctx.lineWidth = 1;
        ctx.clearRect(0, 0, w, h);
        // ctx.strokeRect(0, 0, w, h);
        ctx.transform(1, 0, 0, 1, w / 2, h / 2);
    };
}

function load_from_query() {
    const queryDict = {};
    location.search
        .substr(1)
        .split("&")
        .forEach(function(item) {
            queryDict[item.split("=")[0]] = item.split("=")[1];
        });

    for (const p in queryDict) {
        if (p != "") this.P[p] = queryDict[p];
    }
}

function is_active(params) {
    for (const p in params) {
        if (this.P[p] != params[p]) {
            return false;
        }
    }
    return true;
}

function smooth(val1, val2) {
    return data.P.smooth * val1 + (1 - data.P.smooth) * val2;
}

