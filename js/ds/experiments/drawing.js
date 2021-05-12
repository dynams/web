export function draw_dot(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
}

export function draw_bounding_box({ P, ctx }) {
    const { w, h } = P.k;

    ctx.strokeStyle = "white";
    ctx.fillStyle = "white";
    ctx.lineWidth = 3;

    ctx.strokeRect(-w / 2, -h / 2, w, h);
}
