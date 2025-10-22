class Car {
    constructor(x, y, width, height, controlType, maxSpeed=3){
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = 0;
        this.acceleration = 0.2;
        this.maxSpeed = maxSpeed;
        this.friction = 0.05;
        this.angle = 0;
        this.damaged = false;

        this.useBrain = controlType == "AI";
        this.useSimpleAI = controlType == "SimpleAI";

        if(controlType != "Traffic"){
            this.sensor = new Sensor(this);
            // always attach a brain so SimpleAI can blend with it and evolve
            this.brain = new NeuralNetwork(
                [this.sensor.rayCount, 32, 16, 4]
            );
        }

        this.controles = new Controles(controlType);
    }
    update(roadBorders, traffic){
         if(!this.damaged){
            this.#move();
            this.polygon = this.#createPolygon();
            this.damaged = this.#assessDamage(roadBorders, traffic);
        }
        if(this.sensor){
            this.sensor.update(roadBorders, traffic);
            const offsets = this.sensor.readings.map(
                s => s == null ? 0 : 1-s.offset);
            const outputs = this.brain ? NeuralNetwork.feedForward(offsets, this.brain) : [0,0,0,0];

            if(this.useBrain && this.brain){
                this.controles.forward = outputs[0] > 0.5;
                this.controles.left = outputs[1] > 0.5;
                this.controles.right = outputs[2] > 0.5;
                this.controles.reverse = outputs[3] > 0.5;
                this.brainControls = {
                    forward: outputs[0],
                    left: outputs[1],
                    right: outputs[2],
                    reverse: outputs[3]
                };
            } else if (this.useSimpleAI){
                // compute heuristic magnitudes first
                this.#runSimpleAI();
                // blend brain outputs with heuristic to encourage learning
                const blended = {
                    forward: Math.min(1, Math.max(0, 0.5*this.brainControls.forward + 0.5*outputs[0])) ,
                    left: Math.min(1, Math.max(0, 0.5*(this.brainControls.left||0) + 0.5*outputs[1])) ,
                    right: Math.min(1, Math.max(0, 0.5*(this.brainControls.right||0) + 0.5*outputs[2])) ,
                    reverse: Math.min(1, Math.max(0, 0.5*(this.brainControls.reverse||0) + 0.5*outputs[3]))
                };
                this.brainControls = blended;
                this.controles.forward = blended.forward > 0.5;
                this.controles.left = blended.left > 0.5;
                this.controles.right = blended.right > 0.5;
                this.controles.reverse = blended.reverse > 0.5;
            }
        }
    }
    #runSimpleAI(){
        // convert sensor readings to distances in [0,1]; 1 means clear, 0 means obstacle at nose
        const distances = this.sensor.readings.map(r => r ? 1 - r.offset : 1);
        const n = distances.length; // expected 7
        const mid = Math.floor(n/2); // 3 when n=7
        const center = distances[mid] ?? 1;

        // weighted side clearance favoring rays closer to the center
        // left indices: mid-1, mid-2, mid-3  -> weights 1.0, 0.7, 0.4
        // right indices: mid+1, mid+2, mid+3 -> weights 1.0, 0.7, 0.4
        const lw = [1.0, 0.7, 0.5];
        const rw = [1.0, 0.7, 0.5];
        const leftClear = [mid-1, mid-2, mid-3]
            .map((idx, i) => (distances[idx] ?? 1) * lw[i])
            .reduce((a,b)=>a+b, 0) / lw.reduce((a,b)=>a+b, 0);
        const rightClear = [mid+1, mid+2, mid+3]
            .map((idx, i) => (distances[idx] ?? 1) * rw[i])
            .reduce((a,b)=>a+b, 0) / rw.reduce((a,b)=>a+b, 0);

        // decide steering: push aggressively toward clearer side if blocked
        const sideGap = rightClear - leftClear; // >0 means right is clearer
        const closeness = 1 - center; // higher when obstacle is near ahead

        // reset booleans first
        this.controles.forward = false;
        this.controles.left = false;
        this.controles.right = false;
        this.controles.reverse = false; // prefer no reverse; try to move around

        // throttle: keep moving forward even when center blocked if a side is available
        // base on best of center and side clearance so it doesn't stall behind traffic
        const bestSide = Math.max(leftClear, rightClear);
        const throttle = Math.min(1, Math.max(0.45, center*0.6 + bestSide*0.5));
        this.controles.forward = throttle > 0.05;

        // provide magnitudes for smoother steering/throttle in #move()
        this.brainControls = {
            forward: throttle,
            left: 0,
            right: 0,
            reverse: 0
        };

        // steering magnitude grows when it's tight ahead and when the side difference is large
        const steerNeed = Math.min(1, closeness*1.2 + Math.min(1, Math.abs(sideGap))*0.8);
        if(center < 0.7 || Math.abs(sideGap) > 0.15){
            if(sideGap > 0){
                this.controles.right = true;
                this.brainControls.right = Math.max(0.4, steerNeed);
            }else if(sideGap < 0){
                this.controles.left = true;
                this.brainControls.left = Math.max(0.4, steerNeed);
            }else{
                // equal sides: pick the side with slightly more far clearance (use extreme rays)
                const farLeft = distances[0] ?? 1;
                const farRight = distances[n-1] ?? 1;
                if(farRight >= farLeft){
                    this.controles.right = true;
                    this.brainControls.right = Math.max(0.4, steerNeed*0.9);
                }else{
                    this.controles.left = true;
                    this.brainControls.left = Math.max(0.4, steerNeed*0.9);
                }
            }
        }

        // extreme fallback: if we're almost touching and both sides are also very tight, momentarily stop
        if(center < 0.08 && leftClear < 0.15 && rightClear < 0.15){
            this.controles.forward = false;
            this.brainControls.forward = 0;
        }
    }
    #assessDamage(roadBorders, traffic){
        for(let i=0; i<roadBorders.length; i++){
            if(polysIntersect(this.polygon, roadBorders[i] )){
                return true;
            }
        }
        for(let i=0; i<traffic.length; i++){
            if(polysIntersect(this.polygon, traffic[i].polygon)){
                return true;
            }
        }
        return false;
    }
    #createPolygon(){
        const points = [];
        const rad = Math.hypot(this.width, this.height) / 2;
        const alpha = Math.atan2(this.width, this.height);
        points.push({
            x: this.x + Math.sin(this.angle - alpha) * rad,
            y: this.y + Math.cos(this.angle - alpha) * rad
        });
        points.push({
            x: this.x + Math.sin(this.angle + alpha) * rad,
            y: this.y + Math.cos(this.angle + alpha) * rad
        });
        points.push({
            x: this.x + Math.sin(Math.PI + this.angle - alpha) * rad,
            y: this.y + Math.cos(Math.PI + this.angle - alpha) * rad
        });
        points.push({
            x: this.x + Math.sin(Math.PI + this.angle + alpha) * rad,
            y: this.y + Math.cos(Math.PI + this.angle + alpha) * rad
        });
        return points;
    }

    #move(){
        // determine throttle magnitude: prefer brain magnitudes if available
        let forwardMag = 0;
        let reverseMag = 0;
        if(this.brainControls){
            forwardMag = this.brainControls.forward;
            reverseMag = this.brainControls.reverse;
        }
        // keyboard booleans fall back to full throttle
        if(this.controles.forward && forwardMag === 0){
            forwardMag = 1;
        }
        if(this.controles.reverse && reverseMag === 0){
            reverseMag = 1;
        }

        this.speed += this.acceleration * (forwardMag - reverseMag);
        if(this.speed > this.maxSpeed){
            this.speed = this.maxSpeed;
        }
        if(this.speed < -this.maxSpeed/2){
            this.speed = -this.maxSpeed/2;
        }
        if(this.speed > 0){
            this.speed -= this.friction;
        }
        if(this.speed < 0){
            this.speed += this.friction;
        }
        if(Math.abs(this.speed) < this.friction){
            this.speed = 0;
        }
        if (this.speed != 0){
            const flip = this.speed > 0 ? 1 : -1;

            // steering magnitude: use brain magnitudes if present, otherwise booleans
            let leftMag = this.brainControls ? this.brainControls.left : 0;
            let rightMag = this.brainControls ? this.brainControls.right : 0;
            if(this.controles.left && leftMag === 0) leftMag = 1;
            if(this.controles.right && rightMag === 0) rightMag = 1;

            const steerStrength = 0.03;
            this.angle += steerStrength * flip * (leftMag - rightMag);
        }
        this.x -= Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;
    }

    draw(ctx, color, drawSensor = false){
        if(this.damaged){
            ctx.fillStyle = "gray";
        }else{
            ctx.fillStyle = color;
        }
        ctx.beginPath();
        ctx.moveTo(this.polygon[0].x, this.polygon[0].y);
        for(let i = 1; i < this.polygon.length; i++){
            ctx.lineTo(this.polygon[i].x, this.polygon[i].y);
        } 
        ctx.fill();

        if(this.sensor && drawSensor){
            this.sensor.draw(ctx);
        }
    }
}