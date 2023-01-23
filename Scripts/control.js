"use strict";
var Prototyp;
(function (Prototyp) {
    let background = document.getElementById("screen");
    var hammer = new Hammer(background);
    hammer.get("swipe").set({ direction: Hammer.DIRECTION_ALL });
    hammer.get("pan").set({ threshold: 100, direction: Hammer.DIRECTION_UP });
    hammer.on("pan", function (ev) {
        if (Prototyp.gameInstance.gameState == Prototyp.GAME_STATE.SHOVE) {
            Prototyp.onAction("pan," + ev.overallVelocity + "," + ev.deltaX + "," + ev.deltaY);
        }
    });
    hammer.on("panend", function (ev) {
        if (Prototyp.gameInstance.gameState == Prototyp.GAME_STATE.SHOVE) {
            Prototyp.onAction("panend," + ev.overallVelocity + "," + ev.deltaX + "," + ev.deltaY);
        }
    });
    hammer.on("swiperight", function (ev) {
        Prototyp.onAction("right");
    });
    hammer.on("swipeleft", function (ev) {
        Prototyp.onAction("left");
    });
    hammer.on("swipeup", function (ev) {
        Prototyp.onAction("up");
    });
    hammer.on("swipedown", function (ev) {
        Prototyp.onAction("down");
    });
    hammer.add(new Hammer.Tap({ event: "doubletap", taps: 2, posThreshold: 100 }));
    hammer.get("doubletap").recognizeWith("tap");
    hammer.on("doubletap", function (ev) {
        if (Prototyp.gameInstance.gameState == Prototyp.GAME_STATE.SEARCHING) {
            let width = window.innerWidth;
            let height = window.innerHeight;
            let percX = Math.round(ev.center.x / width * 100);
            let percY = Math.round(ev.center.y / height * 100);
            Prototyp.onAction("doubletap," + percX + "," + percY);
        }
        else {
            Prototyp.onAction("doubletap");
        }
    });
    hammer.add(new Hammer.Press({ event: "hold", pointers: 1, threshold: 15, time: 2000 }));
    hammer.get("hold").recognizeWith("press");
    hammer.on("hold", function (ev) {
        // onAction("hold," + ev.center.x + "," + ev.center.y);
    });
    //OLD CUSTOM SWIPE IMPLEMENTATION
    background.addEventListener("touchstart", on_Touch_Start);
    background.addEventListener("touchmove", on_Touch_Happening);
    background.addEventListener("touchend", on_Touch_End);
    class Circle {
        constructor(_x, _y, _radius) {
            this.posX = _x;
            this.posY = _y;
            this.radius = _radius;
        }
    }
    let positionX = 0;
    let positionY = 0;
    let isTouching = false;
    function on_Touch_Start(e) {
        isTouching = true;
        //window.requestAnimationFrame(animate);
    }
    Prototyp.on_Touch_Start = on_Touch_Start;
    function on_Touch_End(e) {
        isTouching = false;
    }
    Prototyp.on_Touch_End = on_Touch_End;
    //CANVAS ANIMATION//
    const canvas = document.getElementById("backgroundCanvas");
    const context = canvas.getContext("2d");
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
    let forces = [];
    let particles = [];
    let nParticles = 250;
    let p = 0;
    class Vector2 {
        constructor(_x = 0, _y = 0) {
            this.x = _x;
            this.y = _y;
        }
        add(vector) {
            this.x += vector.x;
            this.y += vector.y;
        }
        reset(x, y) {
            this.x = x;
            this.y = y;
        }
        lerp(vector, n) {
            this.x += (vector.x - this.x) * n;
            this.y += (vector.y - this.y) * n;
        }
    }
    let mouse = new Vector2(canvas.width / 2, canvas.height / 2);
    let emitter = new Vector2(canvas.width / 2, canvas.height / 2);
    function on_Touch_Happening(e) {
        if (Prototyp.gameInstance.gameState == Prototyp.GAME_STATE.SEARCHING) {
            e.preventDefault();
            let current_Touch_Object = e.changedTouches[0];
            let width = window.innerWidth;
            let height = window.innerHeight;
            positionX = current_Touch_Object.pageX;
            positionY = current_Touch_Object.pageY;
            let posXpercentage = Math.round(positionX / width * 100);
            let posYpercentage = Math.round(positionY / height * 100);
            mouse.x = positionX;
            mouse.y = positionY;
            Prototyp.onAction("search," + posXpercentage + "," + posYpercentage);
        }
    }
    Prototyp.on_Touch_Happening = on_Touch_Happening;
    class Particle {
        constructor(x, y) {
            this.position = new Vector2(x, y);
            this.velocity = new Vector2();
            this.acceleration = new Vector2();
            this.alpha = 0;
            this.color = "#000000";
            this.points = [new Vector2(-10 + Math.random() * 20, -10 + Math.random() * 20),
                new Vector2(-10 + Math.random() * 20, -10 + Math.random() * 20),
                new Vector2(-10 + Math.random() * 20, -10 + Math.random() * 20)];
        }
        update() {
            this.velocity.add(this.acceleration);
            this.position.add(this.velocity);
            this.acceleration.reset(0, 0);
            this.alpha -= 0.008;
            if (this.alpha < 0)
                this.alpha = 0;
        }
        follow() {
            let x = Math.floor(this.position.x / 20);
            let y = Math.floor(this.position.y / 20);
            let index = x * Math.floor(canvas.height / 20) + y;
            let force = forces[index];
            if (force)
                this.applyForce(force);
        }
        applyForce(force) {
            this.acceleration.add(force);
        }
        draw() {
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
    function initForces() {
        let i = 0;
        for (let x = 0; x < canvas.width; x += 20) {
            for (let y = 0; y < canvas.height; y += 20) {
                if (!forces[i])
                    forces[i] = new Vector2();
                i++;
            }
        }
        if (i < forces.length) {
            forces.splice(i + 1);
        }
    }
    function updateForces() {
        let i = 0;
        let xOff = 0;
        let yOff = 0;
        for (let x = 0; x < canvas.width; x += 20) {
            xOff += 0.1;
            for (let y = 0; y < canvas.height; y += 20) {
                yOff += 0.1;
                let a = Math.random() * Math.PI * 4;
                if (forces[i])
                    forces[i].reset(Math.cos(a) * 0.05, Math.sin(a) * 0.05);
                i++;
            }
        }
    }
    function initParticles() {
        for (let i = 0; i < nParticles; i++) {
            particles.push(new Particle(Math.random() * canvas.width, Math.random() * canvas.height));
            particles[i].velocity.y = 0.1;
        }
    }
    function drawParticles() {
        for (let i = 0; i < nParticles; i++) {
            particles[i].update();
            particles[i].follow();
            particles[i].draw();
        }
    }
    function launchParticle() {
        particles[p].position.reset(emitter.x, emitter.y);
        particles[p].velocity.reset(-1 + Math.random() * 2, -1 + Math.random() * 2);
        particles[p].color = `#ff0000`;
        particles[p].alpha = 1;
        p++;
        if (p === nParticles)
            p = 0;
    }
    function updateEmitter() {
        emitter.lerp(mouse, 0.2);
    }
    function animate() {
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
    function drawCircle(x, y, _radius, _color) {
        context.beginPath();
        context.arc(x, y, _radius, 0, 2 * Math.PI, true);
        context.fillStyle = _color;
        context.fill();
        context.closePath();
    }
    function drawCircleC(_circle, _color) {
        drawCircle(_circle.posX, _circle.posY, _circle.radius, _color);
    }
})(Prototyp || (Prototyp = {}));
//# sourceMappingURL=control.js.map