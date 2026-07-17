/* ============================================================
   JADE HARBOR — input.js
   Clavier (event.code = touche physique, donc ZQSD azerty et
   WASD qwerty marchent sans config) + souris.
   ============================================================ */
"use strict";
(function (G) {

  const down = Object.create(null);     // maintenu
  const pressed = Object.create(null);  // front montant (consommé chaque frame)
  const mouse = { x: 0, y: 0, down: false, clicked: false, usedRecently: 0 };

  const PREVENT = new Set([
    "Tab", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyC", "KeyM", "KeyK", "KeyP",
    "Digit1", "Digit2", "Digit3", "Digit4", "Enter", "ShiftLeft", "ShiftRight"
  ]);

  window.addEventListener("keydown", (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!down[e.code]) pressed[e.code] = true;
    down[e.code] = true;
  });
  window.addEventListener("keyup", (e) => { down[e.code] = false; });
  window.addEventListener("blur", () => {
    for (const k in down) down[k] = false;
  });

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
  });
  window.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      mouse.down = true; mouse.clicked = true;
      // seuls les clics sur le jeu comptent comme « visée souris »
      if (e.target && e.target.id === "game") mouse.usedRecently = 2.0;
    }
  });
  window.addEventListener("mouseup", (e) => { if (e.button === 0) mouse.down = false; });
  window.addEventListener("contextmenu", (e) => {
    if (e.target && e.target.id === "game") e.preventDefault();
  });

  function isDown(code) { return !!down[code]; }
  function wasPressed(code) { return !!pressed[code]; }

  // Axes de déplacement : ZQSD / WASD (physique) + flèches
  function axis() {
    let x = 0, y = 0;
    if (down.KeyA || down.ArrowLeft) x -= 1;
    if (down.KeyD || down.ArrowRight) x += 1;
    if (down.KeyW || down.ArrowUp) y -= 1;
    if (down.KeyS || down.ArrowDown) y += 1;
    if (x && y) { x *= 0.7071; y *= 0.7071; }
    return { x, y };
  }

  function endFrame(dt) {
    for (const k in pressed) pressed[k] = false;
    mouse.clicked = false;
    mouse.usedRecently = Math.max(0, mouse.usedRecently - dt);
  }

  G.Input = {
    isDown, wasPressed, axis, endFrame, mouse,
    get sprint()    { return isDown("ShiftLeft") || isDown("ShiftRight"); },
    get action()    { return wasPressed("KeyE") || wasPressed("Enter"); },
    get attackHeld(){ return isDown("Space") || mouse.down; },
    get attackTap() { return wasPressed("Space") || mouse.clicked; },
    get mouseFire() { return mouse.down; }
  };

})(window.G);
