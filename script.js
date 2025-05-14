// === Globale Variablen ===
let protectionTime = 3000; // Schutzzeit in Millisekunden
let gameStartTime = 0;
const countdownDiv = document.getElementById("countdown");
let blackRings = 0;
let blueRings = 0;
let blackRingsBefore = 0;
let blueRingsBefore = 0;
let cooldownInterval = null;
let cooldownRemaining = 0;
let upgrades = {
    "0/0": { unlocked: true, bought: false, cost: 25, description: "Grüner Kreis 10% langsamer", currency: "black" },
    "0/1": { unlocked: false, bought: false, cost: 50, description: "Roter Kreis 5% schneller", currency: "black" },
    "-1/0": { unlocked: false, bought: false, cost: 125, description: "10% Chance auf +1 Ring", currency: "black" },
    
    // NEUE Upgrades:
    "0/-1": { unlocked: false, bought: false, cost: 100, description: "Grüner Kreis 5% langsamer", currency: "black" },
    "-1/-1": { unlocked: false, bought: false, cost: 250, description: "Zweiter schwarzer Ring", currency: "black" },
    "-2/-1": { unlocked: false, bought: false, cost: 300, description: "1% der schwarzen Ringe werden blau", currency: "black" },
    "0/-2": { unlocked: false, bought: false, cost: 125, description: "Doppelte schwarze Ringe", currency: "black" },
    "1/0": { unlocked: false, bought: false, cost: 1, description: "Grüner Kreis 10% kleiner", currency: "blue" },  
    "0/2": { unlocked: false, bought: false, cost: 100, description: "Nur 5 Sekunden Wartezeit nach Spielende", currency: "black" },
    "1/2": { unlocked: false, bought: false, cost: 3, description: "Kreise beschleunigen nur um 1,25%", currency: "blue" }

};

let isCooldown = false;

// === DOM-Elemente ===
const menu = document.getElementById("menu");
const gameCanvas = document.getElementById("game-canvas");
const ctx = gameCanvas.getContext("2d");
const ringCounter = document.getElementById("ring-counter");
const upgradeTree = document.getElementById("upgrade-tree");
const startGameBtn = document.getElementById("start-game");

// === Spiel-Objekte ===
let mouseX = 0, mouseY = 0;
let redCircle = { x: 100, y: 100, speed: 0, radius: 15 };
let greenCircle = { x: 200, y: 200, speed: 0, radius: 30 }; // grüner Kreis vergrößert
let rings = []; // Liste aller Ringe (schwarz oder blau)
let gameRunning = false;

function updateStartButton() {
    if (isCooldown) {
        if (cooldownRemaining > 0) {
            startGameBtn.disabled = true;
            startGameBtn.textContent = `Warte ${cooldownRemaining} Sekunden`;
        } else {
            startGameBtn.disabled = true;
            startGameBtn.textContent = "Bitte OK drücken!";
        }
    } else if (window.innerWidth < 1000 || window.innerHeight < 600) {
        startGameBtn.disabled = true;
        startGameBtn.textContent = "Fenster zu klein";
    } else {
        startGameBtn.disabled = false;
        startGameBtn.textContent = "Starte Spiel";
    }
}



function updateRingCounter() {
    let text = `Schwarze Ringe: ${blackRings}`;
    
    if (upgrades["-2/-1"]?.bought || blueRings > 0) {
        text += ` | Blaue Ringe: ${blueRings}`;
    }
    
    ringCounter.textContent = text;
}


// === Upgrade-Menü aufbauen ===
function buildUpgradeTree() {
    upgradeTree.innerHTML = "";
    const gridSize = 5;
    const offsetX = 2;
    const offsetY = 2;
    
    for (let gridY = gridSize - 1; gridY >= 0; gridY--) {
        for (let gridX = 0; gridX < gridSize; gridX++) {
            const realX = gridX - offsetX;
            const realY = gridY - offsetY;
            const key = `${realX}/${realY}`;
            
            if (!upgrades[key]) {
                const emptyDiv = document.createElement("div");
                emptyDiv.style.visibility = "hidden";
                upgradeTree.appendChild(emptyDiv);
                continue;
            }

            const upg = upgrades[key];
            if (!upg.unlocked) {
                const emptyDiv = document.createElement("div");
                emptyDiv.style.visibility = "hidden";
                upgradeTree.appendChild(emptyDiv);
                continue;
            }

            const div = document.createElement("div");
            div.className = "upgrade";
            if (upg.bought) div.classList.add("bought");
            let currencyText = (upg.currency === "black") ? "schwarze Ringe" : "blaue Ringe";
            div.innerHTML = `${upg.description}<br>(${upg.cost} ${currencyText})`;

            div.onclick = () => buyUpgrade(key);
            upgradeTree.appendChild(div);
        }
    }
}


// === Upgrade kaufen ===
function buyUpgrade(key) {
    const upg = upgrades[key];
    if (!upg.unlocked || upg.bought) return;
    if (upg.currency === "black" && blackRings < upg.cost) return;
    if (upg.currency === "blue" && blueRings < upg.cost) return;

    
    if (upg.currency === "black") blackRings -= upg.cost;
    else if (upg.currency === "blue") blueRings -= upg.cost;

    upg.bought = true;
    updateRingCounter();
    unlockAdjacent(key);
    buildUpgradeTree();
}

// === Angrenzende Upgrades freischalten ===
function unlockAdjacent(key) {
    const [x, y] = key.split('/').map(Number);
    const neighbors = [
        `${x+1}/${y}`,
        `${x-1}/${y}`,
        `${x}/${y+1}`,
        `${x}/${y-1}`
    ];
    for (const n of neighbors) {
        if (upgrades[n]) upgrades[n].unlocked = true;
    }
}

// === Spiel starten ===
startGameBtn.onclick = () => {
    if (isCooldown) return alert("Bitte warte 10 Sekunden...");
    if (window.innerWidth < 1000 || window.innerHeight < 600) {
        alert("Fenster zu klein!");
        return;
    }
    menu.style.display = "none";
    gameCanvas.style.display = "block";
    gameCanvas.width = window.innerWidth;
    gameCanvas.height = window.innerHeight;
    initGame();
    gameLoop();
};

function spawnRing(type) {
    let ring = {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: (type === "blue") ? 10 : 15, // Blaue Ringe kleiner
        color: (type === "blue") ? "blue" : "black",
        type: type
    };
    rings.push(ring);
}

function spawnSecondRingSeparated() {
    let firstRing = rings[0];
    let tries = 0;
    let newRing;

    do {
        newRing = {
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            radius: 15,
            color: "black",
            type: "black"
        };
        tries++;
    } while (distance(firstRing, newRing) < 100 && tries < 100); 
    // Abstand mindestens 100 Pixel zum ersten Ring!

    rings.push(newRing);
}

// === Spiel initialisieren ===
function initGame() {
    let windowSize = Math.min(window.innerWidth, window.innerHeight);
    redCircle.x = Math.random() * window.innerWidth;
    redCircle.y = Math.random() * window.innerHeight;
    redCircle.speed = windowSize;
    blackRingsBefore = blackRings;
    blueRingsBefore = blueRings;


    greenCircle.x = Math.random() * window.innerWidth;
    greenCircle.y = Math.random() * window.innerHeight;
    greenCircle.speed = windowSize * 2/3;

    if (upgrades["0/0"]?.bought) greenCircle.speed *= 0.9;
    if (upgrades["0/1"]?.bought) redCircle.speed *= 1.05;

    rings = [];

    // Immer mindestens ein schwarzer Ring spawnen
    spawnRing("black");

    // Falls -1/-1 gekauft wurde, zweiter schwarzer Ring extra spawnen
    if (upgrades["-1/-1"]?.bought) {
        spawnSecondRingSeparated();
    }

    gameRunning = true;
    gameStartTime = Date.now();
    showCountdown();
}


function ringCollected(index) {
    let ring = rings[index];

    if (Date.now() - gameStartTime < protectionTime) {
        // Während Schutzzeit: nichts tun
        return;
    }

    if (ring.type === "black") {
        blackRings += 1;

        if (upgrades["-1/0"]?.bought && Math.random() < 0.1) {
            blackRings += 1; // 10% Chance auf doppelten schwarzen Ring
        }
        
        // Doppelte schwarze Ringe Upgrade:
        if (upgrades["0/-2"]?.bought) {
            blackRings += 1; // Noch ein extra schwarzer Ring
        }

    } else if (ring.type === "blue") {
        blueRings += 1;
    }

    rings.splice(index, 1); // Ring entfernen
    spawnRing(
        upgrades["-2/-1"]?.bought && Math.random() < 0.01
            ? "blue"
            : "black"
    );


    updateRingCounter();
    const multiplier = upgrades["1/2"]?.bought ? 1.0125 : 1.015;
    redCircle.speed *= multiplier;
    greenCircle.speed *= multiplier;

}

function showCountdown() {
    countdownDiv.style.display = "block";
    updateCountdown();
}

function updateCountdown() {
    let timeSinceStart = Date.now() - gameStartTime;
    let secondsLeft = 3 - Math.floor(timeSinceStart / 1000);

    if (secondsLeft > 0) {
        countdownDiv.textContent = secondsLeft;
        setTimeout(updateCountdown, 100);
    } else {
        countdownDiv.style.display = "none";
    }
}


// === Ring auf zufällige Position setzen ===
function randomizeRing() {
    blackRing.x = Math.random() * window.innerWidth;
    blackRing.y = Math.random() * window.innerHeight;
}

// === Haupt-Spiel-Schleife ===
function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    moveTowards(redCircle, mouseX, mouseY, redCircle.speed / 60);
    moveTowards(greenCircle, redCircle.x, redCircle.y, greenCircle.speed / 60);

    // Alle Ringe zeichnen:
    for (let ring of rings) {
        drawRing(ring.x, ring.y, ring.radius, ring.color);
    }

    // Spieler und Verfolger zeichnen:
    drawCircle(redCircle.x, redCircle.y, redCircle.radius, "red");
    drawCircle(greenCircle.x, greenCircle.y, greenCircle.radius, "green");

    // Kollisionen prüfen (wird in anderem Code erledigt)
    let timeSinceStart = Date.now() - gameStartTime;
    if (timeSinceStart > protectionTime) {
        for (let i = 0; i < rings.length; i++) {
            let ring = rings[i];
            if (distance(redCircle, ring) < redCircle.radius + ring.radius) {
                ringCollected(i);
                break;
            }
        }
        if (distance(greenCircle, redCircle) < greenCircle.radius + redCircle.radius) {
            endGame();
            return;
        }
    }

    requestAnimationFrame(gameLoop);
}



// === Hilfsfunktionen ===
function moveTowards(obj, targetX, targetY, speed) {
    const dx = targetX - obj.x;
    const dy = targetY - obj.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > speed) {
        obj.x += (dx / dist) * speed;
        obj.y += (dy / dist) * speed;
    } else {
        obj.x = targetX;
        obj.y = targetY;
    }
}

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function drawCircle(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawRing(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.stroke();
}


// === Wenn schwarzer Ring eingesammelt wird ===
function blackRingCollected() {
    randomizeRing();
    blackRings += 1;

    if (upgrades["-1/0"].bought && Math.random() < 0.1) {
        blackRings += 1;
      // Chance auf blauen Ring bei gekauftem "-2/-1"-Upgrade
        if (upgrades["-2/-1"].bought && Math.random() < 0.01) {
            blueRings += 1;
}

    }

    ringCounter.textContent = `Schwarze Ringe: ${blackRings} | Blaue Ringe: ${blueRings}`;
    redCircle.speed *= 1.015;
    greenCircle.speed *= 1.015;
}

// === Spielende ===
function endGame() {
    gameRunning = false;

    menu.style.display = "none";
    gameCanvas.style.display = "none";
    upgradeTree.style.display = "none";

    const gameEndTime = Date.now();
    const durationSeconds = Math.floor((gameEndTime - gameStartTime) / 1000);

    const blackGained = blackRings - blackRingsBefore;
    const blueGained = blueRings - blueRingsBefore;

    let summary = `<p>Spielzeit: ${durationSeconds} Sekunden</p>`;
    if (blackGained > 0) summary += `<p>Schwarze Ringe gesammelt: ${blackGained}</p>`;
    if (blueGained > 0) summary += `<p>Blaue Ringe gesammelt: ${blueGained}</p>`;


    document.getElementById("lose-details").innerHTML = summary;
    document.getElementById("lose-screen").style.display = "flex";

    isCooldown = true;
    cooldownRemaining = upgrades["0/2"]?.bought ? 5 : 10;

    cooldownInterval = setInterval(() => {
        cooldownRemaining--;
        if (cooldownRemaining < 0) cooldownRemaining = 0;
        updateStartButton();
        if (cooldownRemaining <= 0) {
            clearInterval(cooldownInterval);
            isCooldown = false;
            updateStartButton();
        }
    }, 1000);

    updateStartButton();
}



gameCanvas.addEventListener("mousemove", e => {
    const rect = gameCanvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});


// Spiel initialisieren
buildUpgradeTree();
updateRingCounter();
updateStartButton();
window.addEventListener("resize", updateStartButton);
const saveGameBtn = document.getElementById("save-game");
const loadGameBtn = document.getElementById("load-game");

saveGameBtn.onclick = () => {
    const saveData = {
        blackRings: blackRings,
        blueRings: blueRings,
        upgrades: {}
    };

    for (const key in upgrades) {
        saveData.upgrades[key] = {
            bought: upgrades[key].bought,
            unlocked: upgrades[key].unlocked
        };
    }

    const saveString = btoa(JSON.stringify(saveData)); // btoa = Base64-verschlüsselt (damit es kürzer ist)
    prompt("Hier ist dein Speichertext:", saveString);
};

loadGameBtn.onclick = () => {
    const loadString = prompt("Bitte Speichertext eingeben:");
    if (!loadString) return;

    try {
        const saveData = JSON.parse(atob(loadString)); // atob = Base64 entschlüsseln

        blackRings = saveData.blackRings ?? 0;
        blueRings = saveData.blueRings ?? 0;

        for (const key in upgrades) {
            if (saveData.upgrades?.[key]) {
                upgrades[key].bought = saveData.upgrades[key].bought;
            } else {
                upgrades[key].bought = false; // Neues Upgrade → nicht gekauft
            }
        }

        // Jetzt Upgrades freischalten nach Nachbarn
        for (const key in upgrades) {
            const [x, y] = key.split('/').map(Number);
            const neighbors = [
                `${x+1}/${y}`,
                `${x-1}/${y}`,
                `${x}/${y+1}`,
                `${x}/${y-1}`
            ];

            upgrades[key].unlocked = false; // Erstmal alle sperren

            for (const neighbor of neighbors) {
                if (upgrades[neighbor]?.bought) {
                    upgrades[key].unlocked = true;
                    break;
                }
            }
        }

        // Sonderfall: 0/0 muss immer freigeschaltet sein!
        if (upgrades["0/0"]) upgrades["0/0"].unlocked = true;

        buildUpgradeTree();
        updateRingCounter();
        updateStartButton();

        alert("Spielstand erfolgreich geladen!");
    } catch (e) {
        alert("Fehler beim Laden! Ungültiger Speichertext.");
    }
};
document.getElementById("close-lose").onclick = () => {
    document.getElementById("lose-screen").style.display = "none";
    menu.style.display = "flex";
    upgradeTree.style.display = "grid";
    updateStartButton(); // Wichtig, damit "Starte Spiel" weiter deaktiviert bleibt
};