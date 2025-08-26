const carCanvas = document.getElementById("CarCanvas");
carCanvas.width = 200;

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
    new Car(road.getLaneCenter(1), -350, 30, 50, "Traffic", 2),
    new Car(road.getLaneCenter(0), -100, 30, 50, "Traffic", 2),
    new Car(road.getLaneCenter(1), -100, 30, 50, "Traffic", 2),
    new Car(road.getLaneCenter(2), -350, 30, 50, "Traffic", 2),
];

animate();

function save(){
    localStorage.setItem("bestBrain",
        JSON.stringify(bestCar.brain));
}
function discard(){
    localStorage.removeItem("bestBrain");
}   

function generateCars(N){
    const cars = [];
    for(let i = 0; i < N; i++){
        cars.push(new Car(road.getLaneCenter(1), 100, 30, 50, "AI"));
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
    Visualizer.drawNetwork(networkctx, bestCar.brain);

    requestAnimationFrame(animate);
}