

namespace Prototyp {
    let background: HTMLDivElement = <HTMLDivElement>document.getElementById("screen");

    var hammer: any = new Hammer(background);

    hammer.get("swipe").set({ direction: Hammer.DIRECTION_ALL });


    hammer.get("pan").set({ threshold: 100, direction: Hammer.DIRECTION_UP });
    hammer.on("pan", function (ev: any) {
      
        if (gameInstance.gameState == GAME_STATE.SHOVE) {
            onAction("pan," + ev.overallVelocity + "," + ev.deltaX + "," + ev.deltaY)
        }
    });


    hammer.on("panend", function (ev: any) {
       if(gameInstance.gameState == GAME_STATE.SHOVE){
        onAction("panend,"+ ev.overallVelocity + "," + ev.deltaX + "," + ev.deltaY);
       }
    });


    hammer.on("swiperight", function (ev: any) {
        onAction("right");
    });

    hammer.on("swipeleft", function (ev: any) {
        onAction("left");
    });

    hammer.on("swipeup", function (ev: any) {
        onAction("up");
    });

    hammer.on("swipedown", function (ev: any) {
        onAction("down");
    });

    hammer.add(new Hammer.Tap({ event: "doubletap", taps: 2, posThreshold: 100 }));

    hammer.get("doubletap").recognizeWith("tap");

    hammer.on("doubletap", function (ev: any) {


        if (gameInstance.gameState == GAME_STATE.SEARCHING) {
            let width: number = window.innerWidth;
            let height: number = window.innerHeight;
            let percX: number = Math.round(ev.center.x / width * 100);
            let percY: number = Math.round(ev.center.y / height * 100);
            onAction("doubletap," + percX + "," + percY);

        }
        else {
            onAction("doubletap");
        }
    });

    hammer.add(new Hammer.Press({ event: "hold", pointers: 1, threshold: 15, time: 2000 }));

    hammer.get("hold").recognizeWith("press");

    hammer.on("hold", function (ev: any) {
       // onAction("hold," + ev.center.x + "," + ev.center.y);
    });

    //OLD CUSTOM SWIPE IMPLEMENTATION

    background.addEventListener("touchstart", on_Touch_Start);

    background.addEventListener("touchmove", on_Touch_Happening);

    background.addEventListener("touchend", on_Touch_End);

    class Circle {
        posX: number;
        posY: number;
        radius: number;

        constructor(_x: number, _y: number, _radius: number) {
            this.posX = _x;
            this.posY = _y;
            this.radius = _radius;
        }

    }


    let positionX: number = 0;
    let positionY: number = 0;

    let isTouching: boolean = false;


    export function on_Touch_Start(e: TouchEvent): void {
        isTouching = true;
        //window.requestAnimationFrame(animate);
    }



    export function on_Touch_End(e: TouchEvent): void {
        isTouching = false;

    }

    //CANVAS ANIMATION//
    const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById("backgroundCanvas");
    const context: CanvasRenderingContext2D = canvas.getContext("2d");


    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;

    let forces: Vector2[] = [];
    let particles: Particle[] = [];
    let nParticles: number = 250;
    let p: number = 0;


    class Vector2 {

        x: number;
        y: number;
        constructor(_x: number = 0, _y: number = 0) {
            this.x = _x;
            this.y = _y;
        }
        add(vector: Vector2): void {
            this.x += vector.x;
            this.y += vector.y;
        }
        reset(x: number, y: number): void {
            this.x = x;
            this.y = y;
        }
        lerp(vector: Vector2, n: number): void {
            this.x += (vector.x - this.x) * n;
            this.y += (vector.y - this.y) * n;
        }
    }

    let mouse: Vector2 = new Vector2(canvas.width / 2, canvas.height / 2);
    let emitter: Vector2 = new Vector2(canvas.width / 2, canvas.height / 2);

    export function on_Touch_Happening(e: TouchEvent): void {
        if (gameInstance.gameState == GAME_STATE.SEARCHING) {
            e.preventDefault();
            let current_Touch_Object: Touch = e.changedTouches[0];
            let width = window.innerWidth;
            let height = window.innerHeight;
            positionX = current_Touch_Object.pageX;
            positionY = current_Touch_Object.pageY;

            let posXpercentage: number = Math.round(positionX / width * 100);
            let posYpercentage: number = Math.round(positionY / height * 100);
            mouse.x = positionX;
            mouse.y = positionY;


            onAction("search," + posXpercentage + "," + posYpercentage);
        }
    }

    class Particle {
        position: Vector2;
        velocity: Vector2;
        acceleration: Vector2;
        alpha: number;
        color: string;
        points: Vector2[];

        constructor(x: number, y: number) {
            this.position = new Vector2(x, y);
            this.velocity = new Vector2();
            this.acceleration = new Vector2();
            this.alpha = 0;
            this.color = "#000000";
            this.points = [new Vector2(-10 + Math.random() * 20, -10 + Math.random() * 20),
            new Vector2(-10 + Math.random() * 20, -10 + Math.random() * 20),
            new Vector2(-10 + Math.random() * 20, -10 + Math.random() * 20)];
        }


        update(): void {
            this.velocity.add(this.acceleration);
            this.position.add(this.velocity);
            this.acceleration.reset(0, 0);
            this.alpha -= 0.008;
            if (this.alpha < 0) this.alpha = 0;
        }

        follow(): void {
            let x: number = Math.floor(this.position.x / 20);
            let y: number = Math.floor(this.position.y / 20);
            let index: number = x * Math.floor(canvas.height / 20) + y;
            let force: Vector2 = forces[index];
            if (force) this.applyForce(force);
        }

        applyForce(force: Vector2): void {
            this.acceleration.add(force);
        }

        draw(): void {
            context.globalAlpha = this.alpha;
            context.beginPath();
            context.moveTo(this.position.x + this.points[0].x, this.position.y + this.points[0].y);
            context.lineTo(this.position.x + this.points[1].x, this.position.y + this.points[1].y);
            context.lineTo(this.position.x + this.points[2].x, this.position.y + this.points[2].y);
            context.closePath();
            context.fillStyle = this.color;
            context.fill();
        }

    }

    function initForces(): void {
        let i: number = 0;
        for (let x: number = 0; x < canvas.width; x += 20) {
            for (let y: number = 0; y < canvas.height; y += 20) {
                if (!forces[i]) forces[i] = new Vector2();
                i++;
            }
        }
        if (i < forces.length) {
            forces.splice(i + 1);
        }
    }

    function updateForces(): void {
        let i: number = 0;
        let xOff: number = 0;
        let yOff: number = 0;
        for (let x: number = 0; x < canvas.width; x += 20) {
            xOff += 0.1;
            for (let y: number = 0; y < canvas.height; y += 20) {
                yOff += 0.1;
                let a: number = Math.random() * Math.PI * 4;
                if (forces[i]) forces[i].reset(Math.cos(a) * 0.05, Math.sin(a) * 0.05);
                i++;
            }
        }
    }


    function initParticles(): void {
        for (let i: number = 0; i < nParticles; i++) {
            particles.push(new Particle(Math.random() * canvas.width, Math.random() * canvas.height));
            particles[i].velocity.y = 0.1;
        }
    }



    function drawParticles(): void {
        for (let i: number = 0; i < nParticles; i++) {
            particles[i].update();
            particles[i].follow();
            particles[i].draw();
        }
    }

    function launchParticle(): void {
        particles[p].position.reset(emitter.x, emitter.y);
        particles[p].velocity.reset(-1 + Math.random() * 2, -1 + Math.random() * 2);
        particles[p].color = `#ff0000`;
        particles[p].alpha = 1;
        p++;
        if (p === nParticles) p = 0;
    }


    function updateEmitter(): void {
        emitter.lerp(mouse, 0.2);
    }


    function animate(): void {
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (isTouching) {
            updateEmitter();
            launchParticle();
        }



        updateForces();
        drawParticles();

        requestAnimationFrame(animate);


    }

    initForces();
    initParticles();


    function drawCircle(x: number, y: number, _radius: number, _color: string): void {
        context.beginPath();
        context.arc(x, y, _radius, 0, 2 * Math.PI, true);
        context.fillStyle = _color;
        context.fill();
        context.closePath();
    }

    function drawCircleC(_circle: Circle, _color: string): void {
        drawCircle(_circle.posX, _circle.posY, _circle.radius, _color);
    }
}