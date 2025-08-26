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

        if(controlType != "Traffic"){
            this.sensor = new Sensor(this);
            this.brain = new NeuralNetwork(
                [this.sensor.rayCount, 6, 4]
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
            const outputs = NeuralNetwork.feedForward(offsets, this.brain);
            

            if(this.useBrain){
                // outputs are continuous in (0,1); map them to control magnitudes
                this.controles.forward = outputs[0] > 0.5; // boolean for compatibility
                this.controles.left = outputs[1] > 0.5;
                this.controles.right = outputs[2] > 0.5;
                this.controles.reverse = outputs[3] > 0.5;

                // store magnitudes for smoother control in movement
                this.brainControls = {
                    forward: outputs[0],
                    left: outputs[1],
                    right: outputs[2],
                    reverse: outputs[3]
                };
            }
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