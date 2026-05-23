const io = require("socket.io-client");
const SERVER = "http://localhost:3000";

let passed = 0, failed = 0;

function test(name, fn) {
    return new Promise((resolve) => {
        fn()
            .then(() => { console.log("  [PASS] " + name); passed++; })
            .catch((err) => { console.log("  [FAIL] " + name + ": " + (err.message || err)); failed++; })
            .finally(() => resolve());
    });
}

function connect(name) {
    return new Promise((resolve, reject) => {
        const sock = io(SERVER, { transports: ["websocket"], forceNew: true });
        sock.on("connect", () => resolve(sock));
        sock.on("connect_error", (err) => reject(err));
        setTimeout(() => reject(new Error(name + " timeout")), 5000);
    });
}

function waitForEvent(sock, event, timeout) {
    timeout = timeout || 5000;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timeout " + event)), timeout);
        sock.once(event, (data) => { clearTimeout(timer); resolve(data); });
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
    console.log("\n=== Facade Frenzy - Test Suite ===\n");

    // 1: HTTP alive
    await test("Server responds 200", async () => {
        return new Promise((resolve, reject) => {
            const http = require("http");
            http.get(SERVER, (res) => { if (res.statusCode === 200) resolve(); else reject(new Error("Status " + res.statusCode)); });
        });
    });

    // 2: WebSocket connect
    await test("WebSocket connects", async () => {
        const s = await connect("t1"); s.disconnect();
    });

    // 3: Local session start
    await test("Local session: start and receive game state", async () => {
        const sock = await connect("local-host");
        sock.emit("startLocalSession", { p1Name: "A", p2Name: "B", gamepadCount: 0 });
        const a = await waitForEvent(sock, "roomAssigned");
        if (!a.roomId) throw new Error("No roomId");
        if (a.type !== "local") throw new Error("Not local");
        if (a.playerIds.length !== 2) throw new Error("Expected 2 players");
        console.log("    Room " + a.roomId + " players: " + a.playerIds);
        await sleep(4000);
        const st = await waitForEvent(sock, "gameState", 8000);
        if (st.phase !== "playing") throw new Error("Phase: " + st.phase);
        if (!st.currentMode) throw new Error("No mode");
        if (!st.currentMap) throw new Error("No map");
        if (!st.entities || st.entities.length < 2) throw new Error("Few entities");
        console.log("    Mode: " + st.currentMode.id + " Map: " + st.currentMap.name + " Entities: " + st.entities.length);
        sock.disconnect();
    });

    // 4: Input moves entity
    await test("Local session: input moves P1", async () => {
        const sock = await connect("input-test");
        sock.emit("startLocalSession", { p1Name: "A", p2Name: "B", gamepadCount: 0 });
        await waitForEvent(sock, "roomAssigned");
        await sleep(4000);
        let st = await waitForEvent(sock, "gameState", 8000);
        const p1i = st.entities.find(e => e.isPlayer && e.playerNum === 1);
        const ix = p1i.x, iy = p1i.y;
        for (let i = 0; i < 20; i++) {
            sock.emit("localInputs", { 1: { right: true, down: true, punch: false, left: false, up: false } });
            await sleep(33);
        }
        await sleep(100);
        st = await waitForEvent(sock, "gameState", 5000);
        const p1a = st.entities.find(e => e.isPlayer && e.playerNum === 1);
        if (Math.hypot(p1a.x - ix, p1a.y - iy) < 1) throw new Error("P1 didn't move");
        console.log("    P1: (" + ix.toFixed(1) + "," + iy.toFixed(1) + ") -> (" + p1a.x.toFixed(1) + "," + p1a.y.toFixed(1) + ")");
        sock.disconnect();
    });

    // 5: Online lobby queue
    await test("Online lobby: queue and lobby count", async () => {
        const s1 = await connect("ol1"), s2 = await connect("ol2");
        let cnt = []; s2.on("lobbyCount", (c) => cnt.push(c));
        s1.emit("joinOnlineMatch", { name: "A" });
        await sleep(400);
        s2.emit("joinOnlineMatch", { name: "B" });
        await sleep(400);
        if (cnt.length === 0) throw new Error("No lobbyCount events");
        if (cnt[cnt.length - 1] !== 2) throw new Error("Expected 2, got " + cnt[cnt.length - 1]);
        // Leave cleanup
        s1.emit("leaveQueue"); s2.emit("leaveQueue");
        await sleep(200);
        s1.disconnect(); s2.disconnect();
    });

    // 6: Online match full flow
    await test("Online match: host starts, all see same state", async () => {
        const p = await Promise.all([ connect("oa"), connect("ob"), connect("oc") ]);
        p.forEach((s, i) => s.emit("joinOnlineMatch", { name: "P" + (i + 1) }));
        await sleep(800);
        // Register listeners BEFORE emitting startOnlineMatch
        const roomPromises = p.map(s => waitForEvent(s, "roomAssigned", 3000));
        p[0].emit("startOnlineMatch");
        const roomAssigns = await Promise.all(roomPromises);
        for (let i = 0; i < 3; i++) {
            if (!roomAssigns[i].roomId) throw new Error("P" + (i+1) + " no room");
            console.log("    P" + (i+1) + " room " + roomAssigns[i].roomId + " id " + roomAssigns[i].playerId);
        }
        await sleep(4000);
        let states = {};
        for (let i = 0; i < 3; i++) {
            const st = await waitForEvent(p[i], "gameState", 8000);
            if (st.phase !== "playing") throw new Error("P" + (i+1) + " phase: " + st.phase);
            states[p[i].id] = st;
        }
        const ref = states[Object.keys(states)[0]];
        for (let key of Object.keys(states)) {
            const s = states[key];
            if (s.currentMode.id !== ref.currentMode.id) throw new Error("Mode mismatch");
            if (s.currentMap.name !== ref.currentMap.name) throw new Error("Map mismatch");
            if (s.entities.length !== ref.entities.length) throw new Error("Entity count mismatch");
        }
        console.log("    All 3 players: same state (" + ref.currentMode.id + ", " + ref.currentMap.name + ")");
        p.forEach(s => s.disconnect());
    });

    // 7: Room isolation
    await test("Room isolation: two local sessions don't interfere", async () => {
        const h1 = await connect("r1"), h2 = await connect("r2");
        const r1p = waitForEvent(h1, "roomAssigned", 3000);
        const r2p = waitForEvent(h2, "roomAssigned", 3000);
        h1.emit("startLocalSession", { p1Name: "R1P1", p2Name: "R1P2", gamepadCount: 0 });
        h2.emit("startLocalSession", { p1Name: "R2P1", p2Name: "R2P2", gamepadCount: 0 });
        const r1 = await r1p, r2 = await r2p;
        if (r1.roomId === r2.roomId) throw new Error("Same room ID!");
        await sleep(4000);
        const [s1, s2] = await Promise.all([ waitForEvent(h1, "gameState", 8000), waitForEvent(h2, "gameState", 8000) ]);
        const p1r1 = s1.entities.find(e => e.isPlayer && e.playerNum === 1);
        const p1r2 = s2.entities.find(e => e.isPlayer && e.playerNum === 1);
        const y1b = p1r1.y, y2b = p1r2.y;
        for (let i = 0; i < 20; i++) {
            h1.emit("localInputs", { 1: { down: true } });
            h2.emit("localInputs", { 1: {} });
            await sleep(33);
        }
        await sleep(100);
        const [s1a, s2a] = await Promise.all([ waitForEvent(h1, "gameState", 5000), waitForEvent(h2, "gameState", 5000) ]);
        const y1a = s1a.entities.find(e => e.isPlayer && e.playerNum === 1).y;
        const y2a = s2a.entities.find(e => e.isPlayer && e.playerNum === 1).y;
        if (Math.abs(y1a - y1b) < 1) throw new Error("Room 1 P1 didn't move");
        if (Math.abs(y2a - y2b) > 1) throw new Error("Room 2 P1 moved (shouldn't)");
        console.log("    Room " + r1.roomId + " moved: yes, Room " + r2.roomId + " moved: no");
        h1.disconnect(); h2.disconnect();
    });

    // 8: Disconnect cleanup
    await test("Disconnect: player leaves queue cleanly", async () => {
        const sock = await connect("leave");
        sock.emit("joinOnlineMatch", { name: "Leaver" });
        await sleep(200);
        sock.emit("leaveQueue");
        await sleep(200);
        sock.disconnect();
    });

    console.log("\n=== Results: " + passed + " passed, " + failed + " failed out of " + (passed + failed) + " ===\n");
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error("Fatal:", err); process.exit(1); });
