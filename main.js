const carCanvas = document.getElementById("CarCanvas");
carCanvas.width = 250;

const networkCanvas = document.getElementById("NetworkCanvas");
networkCanvas.width = 300;

const carctx = carCanvas.getContext("2d");
const networkctx = networkCanvas.getContext("2d");

const road=new Road(carCanvas.width/2,carCanvas.width*0.9);

const N = 100;
const cars = generateCars(N);

let bestCar=cars[0];
if(localStorage.getItem("bestBrain")){
    for(let i=0; i<cars.length; i++){
        cars[i].brain = JSON.parse(localStorage.getItem("bestBrain"));
        if(i!=0){
            NeuralNetwork.mutate(cars[i].brain, 0.2);
        }
    }
}

const traffic = [
    new Car(road.getLaneCenter(0), -100, 30, 50, "Traffic", 2),
    new Car(road.getLaneCenter(0), -250, 30, 50, "Traffic", 2),
    new Car(road.getLaneCenter(0), -800, 30, 50, "Traffic", 2),
    new Car(road.getLaneCenter(2), -100, 30, 50, "Traffic", 2),
    new Car(road.getLaneCenter(1), -450, 30, 50, "Traffic", 2),
    new Car(road.getLaneCenter(1), -650, 30, 50, "Traffic", 2),
];

animate();

function save(){
    if(!bestCar.brain) return;
    localStorage.setItem("bestBrain",
        JSON.stringify(bestCar.brain));
}
function discard(){
    localStorage.removeItem("bestBrain");
}   

function generateCars(N){
    const cars = [];
    for(let i = 0; i < N; i++){
        // blend SimpleAI with a brain for evolution
        cars.push(new Car(road.getLaneCenter(1), 100, 30, 50, "SimpleAI"));
    }
    return cars;
}

function animate(time){
    for(let i = 0; i < traffic.length; i++){
        traffic[i].update(road.borders, []);
    }
    for(let i = 0; i < cars.length; i++){
        cars[i].update(road.borders, traffic);
    }
    bestCar = cars.find(
        c => c.y == Math.min(...cars.map(c => c.y))
    );

    carCanvas.height = window.innerHeight;
    networkCanvas.height = window.innerHeight;

    carctx.save();
    carctx.translate(0, -bestCar.y + carCanvas.height*0.7);

    road.draw(carctx);
    for(let i = 0; i < traffic.length; i++){
        traffic[i].draw(carctx, "red");
    }
    carctx.globalAlpha = 0.2;
    for(let i = 0; i < cars.length; i++){
        cars[i].draw(carctx, "blue");
    }
    carctx.globalAlpha = 1;
    bestCar.draw(carctx, "blue", true);

    carctx.restore();

    networkctx.lineDashOffset = -time/50;
    if(bestCar.brain){
        Visualizer.drawNetwork(networkctx, bestCar.brain);
    } else {
        // clear canvas when no brain to draw
        networkctx.clearRect(0, 0, networkCanvas.width, networkCanvas.height);
    }

    // end of generation: if all cars are damaged, save best and reload to try again
    const allCrashed = cars.every(c => c.damaged);
    if(allCrashed){
        if(bestCar && bestCar.brain){
            localStorage.setItem("bestBrain", JSON.stringify(bestCar.brain));
        }
        // brief delay so last frame renders
        setTimeout(()=>{ location.reload(); }, 250);
        return;
    }
    requestAnimationFrame(animate);
}