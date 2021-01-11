function DynamSpace(data, update_fn, draw_fn, experiments) {
 var vue = new Vue({
	el: "#main",
  data: { 
    ...data,
    H: { //history
    	I: {}, O: {time:[]}, S: {}
    },
    canvas: null,
    params: {
      ...experiments
    },
  },
  filters: {
  	toSeconds(val) { return (val/1000).toFixed(2) },
    toFixed(val) { return Number.isInteger(val) || typeof val == 'boolean' ? val : val.toFixed(2) }
  },
  computed: {
  	csv() {
    	let c = "data:text/csv;charset=utf-8,"
      for (var o in this.H.O) c += 'O.' + o + ','
      for (var i in this.H.I) c += 'I.' + i + ','
      for (var s in this.H.S) c += 'S.' + s + ','
      c += "%0A"
      for (var t = 0; t < this.H.O.time.length; t++) {
        for (var o in this.H.O) c += this.H.O[o][t] + ','
        for (var i in this.H.I) c += this.H.I[i][t] + ','
        for (var s in this.H.S) c += this.H.S[s][t] + ','
        c += "%0A"
      }
      
    	return c
    },
    filename() {
    	return 'data.csv'
    }
  },
  methods: {
  	reset() {
      this.I.hasStarted = false
      this.I.isRunning = false

    	this.O.elapsed = 0
      this.O.fps = 1000/this.P.period
      this.O.period = this.P.period
      this.S.prevT = 0
      this.I.theta = 0   	
      this.S.machine = 0

      for (var i in this.O) this.H.O[i] = []
      for (var i in this.I) this.H.I[i] = []
      for (var i in this.S) this.H.S[i] = []

      this.draw()
    },
    start() {
    	this.I.hasStarted = true      
    	this.I.isRunning = true
      this.tick()
    },
    load(params) {
    	console.log(params)
    	for (var p in params) {
      	this.P[p] = params[p]
      }
    },
    stop() {
    	this.I.isRunning = false
    },
    smooth(val1, val2) {
    	return this.P.smooth*val1 + (1-this.P.smooth)*val2
    },
    log() {
    	for (var i in this.I) this.H.I[i].push(this.I[i])
    	for (var o in this.O) this.H.O[o].push(this.O[o])
    	for (var s in this.S) this.H.S[s].push(this.S[s])
    },
    update() {
      // Output smoothed fps 
      const deltaT = this.O.time - this.S.prevT

      if(this.S.prevT && deltaT) {
        this.O.fps = this.smooth(this.O.fps, 1000/deltaT)
        this.O.period = this.smooth(this.O.period, deltaT)
      }

      // Update system
      update_fn(this.S, this.I, this.O, this.P)

      this.S.prevT = this.O.time
    },
  	tick() {
    	this.O.time = Date.now() 
      this.O.elapsed += this.P.period

      this.update()
      this.draw()
      this.log()

      if(this.O.elapsed >= this.P.duration*1000) {
        this.stop()
      }

      // Call tick
      this.correction = Date.now() - this.O.time
      if (this.I.isRunning) {
        if(this.P.period - this.correction > 0) {
          window.setTimeout(this.tick, this.P.period - this.correction)
        } else if (this.P.period > 0) {
          window.setTimeout(this.tick, this.P.period)
        } else {
          window.setTimeout(this.tick, 20)
        }
      }
    },
    draw() {
      draw_fn(this.canvas, this.S, this.I, this.O, this.P);
    },
    input(e) {
        const rect = this.canvas.getBoundingClientRect();
        const width = this.canvas.width;
        const height = this.canvas.height;
        this.I.posX = e.clientX - rect.left
        this.I.posY = e.clientY - rect.top
        this.I.theta = Math.atan2(this.I.posX - width/2,
                                  this.I.posY - height/2) 
        this.I.radius = Math.sqrt(
          Math.pow(this.I.posX - width/2,2)+
          Math.pow(this.I.posY - height/2,2))
    },
  },
  mounted() {
    this.canvas = this.$refs.myCanvas
		this.canvas.addEventListener('mousemove', this.input)
    //this.canvas.addEventListener('touchmove', this.input)
    this.canvas.addEventListener('mousedown', (e) => {
    	if(!this.I.hasStarted && !this.I.isRunning) {
      	this.start()
      }    	
      else if(this.I.hasStarted && this.I.isRunning) {
      	this.stop()
      }
    })
    this.reset()
  }
})

  Vue.component('')
}

