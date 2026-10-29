#!/usr/bin/env node
/*
 * Emerald Studio Server
 *
 * Unified backend for:
 * 1. Emerald Dialogue Studio (live editing of .string dialogue blocks)
 * 2. Emerald World Map Free-Fly Tester (real-time free-flight overworld & dungeons)
 *
 * Local-only, zero npm dependencies, automatic tile caching.
 */

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const url = require("url");

// Resolve Emerald Project Root
function resolveEmeraldDir() {
    const candidates = [
        process.env.EMERALD_DIR,
        process.argv[2],
        path.resolve(__dirname, "..", "emerald"),
        path.resolve("/Users/saharsh/emerald"),
        process.cwd(),
    ];
    for (const cand of candidates) {
        if (cand && fs.existsSync(cand) && fs.existsSync(path.join(cand, "data", "maps"))) {
            return path.resolve(cand);
        }
    }
    return path.resolve("/Users/saharsh/emerald");
}

const EMERALD_ROOT = resolveEmeraldDir();
const STUDIO_ROOT = __dirname;
const PUBLIC_DIR = path.join(STUDIO_ROOT, "public");
const TILE_CACHE_DIR = path.join(STUDIO_ROOT, "data", "tile_cache");
const ROUTES_FILE = path.join(STUDIO_ROOT, "data", "routes.json");
const MAPS_FILE = path.join(STUDIO_ROOT, "data", "maps_config.json");

const EDITABLE_ROOTS = [
    path.join(EMERALD_ROOT, "data", "maps"),
    path.join(EMERALD_ROOT, "data", "scripts"),
];
const MAP_GROUPS_PATH = path.join(EMERALD_ROOT, "data", "maps", "map_groups.json");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
};

// Story chapters for dialogue grouping
const STORY_CHAPTERS = [
    { title: "01 · New home & first steps", maps: ["InsideOfTruck", "LittlerootTown", "Route101", "OldaleTown", "Route103", "Route102", "PetalburgCity"] },
    { title: "02 · Rustboro & Dewford", maps: ["Route104", "PetalburgWoods", "RustboroCity", "Route116", "RusturfTunnel", "DewfordTown", "GraniteCave", "Route105", "Route106"] },
    { title: "03 · Slateport & Mauville", maps: ["Route107", "Route108", "Route109", "SlateportCity", "Route110", "MauvilleCity"] },
    { title: "04 · Mountain path & Lavaridge", maps: ["Route111", "Route112", "FieryPath", "Route113", "FallarborTown", "Route114", "MeteorFalls", "Route115", "MtChimney", "JaggedPass", "LavaridgeTown"] },
    { title: "05 · Verdanturf & the eastern road", maps: ["VerdanturfTown", "Route117", "Route118"] },
    { title: "06 · Weather Institute & Fortree", maps: ["Route119", "FortreeCity", "Route120"] },
    { title: "07 · Mt. Pyre & Lilycove", maps: ["Route121", "SafariZone", "MtPyre", "Route122", "LilycoveCity", "MagmaHideout", "AquaHideout"] },
    { title: "08 · Mossdeep & the open sea", maps: ["Route123", "Route124", "Route125", "MossdeepCity", "ShoalCave"] },
    { title: "09 · Seafloor Cavern", maps: ["Route126", "Route127", "Route128", "Route129", "Underwater", "SeafloorCavern"] },
    { title: "10 · Sootopolis & Sky Pillar", maps: ["SootopolisCity", "CaveOfOrigin", "SkyPillar", "PacifidlogTown", "Route130", "Route131", "Route132", "Route133", "Route134"] },
    { title: "11 · Ever Grande & the League", maps: ["EverGrandeCity", "VictoryRoad"] },
    { title: "12 · Postgame & Battle Frontier", maps: ["BattleFrontier", "BattlePyramid", "TrainerHill"] },
];
const OPTIONAL_CHAPTER = { title: "13 · Optional, special & shared dialogue", maps: [] };

function buildMapGroupOrder() {
    try {
        if (!fs.existsSync(MAP_GROUPS_PATH)) return new Map();
        const mapGroups = JSON.parse(fs.readFileSync(MAP_GROUPS_PATH, "utf8"));
        const order = new Map();
        let index = 0;
        for (const groupName of mapGroups.group_order || []) {
            const list = mapGroups[groupName] || [];
            for (const mapName of list) {
                if (!order.has(mapName)) {
                    order.set(mapName, index++);
                }
            }
        }
        return order;
    } catch (err) {
        return new Map();
    }
}

const mapGroupOrder = buildMapGroupOrder();

function relativeProjectPath(filePath) {
    return path.relative(EMERALD_ROOT, filePath).replace(/\\/g, "/");
}

function isEditablePath(filePath) {
    const resolved = path.resolve(filePath);
    return EDITABLE_ROOTS.some(root => resolved === root || resolved.startsWith(`${root}${path.sep}`));
}

function walkIncFiles(directory, results = []) {
    if (!fs.existsSync(directory)) return results;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            walkIncFiles(fullPath, results);
        } else if (entry.isFile() && entry.name.endsWith(".inc")) {
            results.push(fullPath);
        }
    }
    return results;
}

function hashSource(source) {
    return crypto.createHash("sha1").update(source, "utf8").digest("hex");
}

function readStringLiteral(line) {
    const match = line.match(/^(\s*\.string\s+)"((?:\\.|[^"\\])*)"\s*$/);
    if (!match) return null;
    return {
        indentation: match[1],
        content: match[2].replace(/\\"/g, '"'),
    };
}

function isLabel(line) {
    return /^[A-Za-z0-9_]+::?\s*$/.test(line.trim());
}

function getMapName(file) {
    const parts = file.split("/");
    if (parts[0] === "data" && parts[1] === "maps" && parts[2]) {
        return parts[2].split("_")[0];
    }
    return path.basename(file, ".inc");
}

function getStoryPosition(mapName) {
    for (let chapterIndex = 0; chapterIndex < STORY_CHAPTERS.length; chapterIndex++) {
        const chapter = STORY_CHAPTERS[chapterIndex];
        const mapIndex = chapter.maps.indexOf(mapName);
        if (mapIndex !== -1) {
            return {
                chapterIndex,
                chapter: chapter.title,
                rank: chapterIndex * 1000 + mapIndex,
            };
        }
    }
    const groupRank = mapGroupOrder.get(mapName);
    return {
        chapterIndex: STORY_CHAPTERS.length,
        chapter: OPTIONAL_CHAPTER.title,
        rank: 900000 + (groupRank !== undefined ? groupRank : 99999),
    };
}

function parseDialogues(filePath) {
    const source = fs.readFileSync(filePath, "utf8");
    const lines = source.split(/\r?\n/);
    const dialogues = [];
    const relativeFile = relativeProjectPath(filePath);
    const mapName = getMapName(relativeFile);
    const story = getStoryPosition(mapName);

    let activeLabel = null;
    let labelLineIndex = -1;
    let startLineIndex = -1;
    let blockLines = [];
    let stringChunks = [];
    let blockIndentation = "    .string ";

    function flush(endLineIndex) {
        if (!activeLabel || !stringChunks.length) {
            reset();
            return;
        }
        const text = stringChunks.join("");
        const blockSource = blockLines.join("\n");
        dialogues.push({
            id: `${relativeFile}::${activeLabel}::${labelLineIndex + 1}`,
            label: activeLabel,
            file: relativeFile,
            mapName,
            chapter: story.chapter,
            chapterIndex: story.chapterIndex,
            storyRank: story.rank,
            startLine: startLineIndex + 1,
            endLine: endLineIndex,
            indentation: blockIndentation,
            text,
            sourceHash: hashSource(blockSource),
            charCount: text.length,
        });
        reset();
    }

    function reset() {
        activeLabel = null;
        labelLineIndex = -1;
        startLineIndex = -1;
        blockLines = [];
        stringChunks = [];
        blockIndentation = "    .string ";
    }

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const trimmed = line.trim();

        if (isLabel(line)) {
            flush(index);
            activeLabel = trimmed.replace(/:+$/, "");
            labelLineIndex = index;
            continue;
        }

        const literal = readStringLiteral(line);
        if (literal) {
            if (!activeLabel) continue;
            if (startLineIndex === -1) {
                startLineIndex = index;
                blockIndentation = literal.indentation;
            }
            blockLines.push(line);
            stringChunks.push(literal.content);
            continue;
        }

        if (startLineIndex !== -1) {
            flush(index);
        }
    }

    flush(lines.length);
    return dialogues;
}

function getAllDialogues() {
    const files = EDITABLE_ROOTS.flatMap(root => walkIncFiles(root));
    const all = files.flatMap(file => parseDialogues(file));
    all.sort((a, b) => a.storyRank - b.storyRank || a.file.localeCompare(b.file) || a.startLine - b.startLine);
    all.forEach((item, index) => { item.sequence = index + 1; });
    return all;
}

function formatDialogueSource(text, indentation) {
    const rawChunks = text.split(/\\p/g);
    const lines = [];
    rawChunks.forEach((chunk, index) => {
        let piece = chunk;
        if (index < rawChunks.length - 1) piece += "\\p";
        if (piece.length) {
            lines.push(`${indentation}"${piece.replace(/"/g, '\\"')}"`);
        }
    });
    if (!lines.length) {
        lines.push(`${indentation}""`);
    }
    return lines.join("\n");
}

function saveDialogue({ id, text, sourceHash }) {
    const [relativeFile, label, lineString] = id.split("::");
    const absolutePath = path.resolve(EMERALD_ROOT, relativeFile);
    if (!isEditablePath(absolutePath)) {
        throw new Error("Path is outside editable directories.");
    }
    const currentList = parseDialogues(absolutePath);
    const target = currentList.find(d => d.id === id);
    if (!target) {
        throw new Error("Dialogue block could not be found. The file may have changed.");
    }
    if (sourceHash && target.sourceHash !== sourceHash) {
        throw new Error("File has changed on disk since it was loaded. Refresh first.");
    }

    const source = fs.readFileSync(absolutePath, "utf8");
    const lines = source.split(/\r?\n/);
    const replacementLines = formatDialogueSource(text, target.indentation).split("\n");
    lines.splice(target.startLine - 1, target.endLine - target.startLine + 1, ...replacementLines);

    fs.writeFileSync(absolutePath, lines.join("\n"), "utf8");
    const refreshed = parseDialogues(absolutePath).find(d => d.label === label);
    return refreshed || target;
}

function sendJson(response, status, data) {
    const body = JSON.stringify(data);
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Access-Control-Allow-Origin": "*",
    });
    response.end(body);
}

function sendFile(response, filePath, contentType) {
    if (!fs.existsSync(filePath)) {
        response.writeHead(404, { "Content-Type": "text/plain" });
        response.end("404 Not Found");
        return;
    }
    const stream = fs.createReadStream(filePath);
    response.writeHead(200, {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
    });
    stream.pipe(response);
}

// Proxy and cache tiles locally
function handleTileRequest(response, mapName, z, x, y) {
    const safeMap = mapName.replace(/[^a-zA-Z0-9_-]/g, "");
    const safeZ = String(parseInt(z, 10));
    const safeX = String(parseInt(x, 10));
    const safeY = String(parseInt(y, 10));

    const cacheDir = path.join(TILE_CACHE_DIR, safeMap, safeZ, safeX);
    const cachedFilePath = path.join(cacheDir, `${safeY}.png`);

    if (fs.existsSync(cachedFilePath)) {
        return sendFile(response, cachedFilePath, "image/png");
    }

    // Download from upstream pkmnmap CDN
    const upstreamUrl = `https://pkmnmap.com/Maps/Emerald/Content/Tilesets/${safeMap}/${safeZ}/${safeX}/${safeY}.png`;

    https.get(upstreamUrl, { headers: { "User-Agent": "EmeraldStudio/1.0" } }, (res) => {
        if (res.statusCode !== 200) {
            res.resume();
            response.writeHead(res.statusCode, { "Content-Type": "text/plain" });
            return response.end(`Tile error ${res.statusCode}`);
        }

        fs.mkdirSync(cacheDir, { recursive: true });
        const fileStream = fs.createWriteStream(cachedFilePath);
        res.pipe(fileStream);

        fileStream.on("finish", () => {
            fileStream.close();
            sendFile(response, cachedFilePath, "image/png");
        });
    }).on("error", (err) => {
        response.writeHead(502, { "Content-Type": "text/plain" });
        response.end(`Failed to fetch tile: ${err.message}`);
    });
}

function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.setEncoding("utf8");
        request.on("data", chunk => {
            body += chunk;
            if (body.length > 5 * 1024 * 1024) reject(new Error("Request too large"));
        });
        request.on("end", () => resolve(body));
        request.on("error", reject);
    });
}

const server = http.createServer(async (request, response) => {
    try {
        const reqUrl = new URL(request.url, `http://${HOST}:${PORT}`);
        const pathname = reqUrl.pathname;

        // CORS Preflight
        if (request.method === "OPTIONS") {
            response.writeHead(204, {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            });
            return response.end();
        }

        // --- API ROUTES ---
        if (pathname === "/api/status" && request.method === "GET") {
            return sendJson(response, 200, {
                emeraldDir: EMERALD_ROOT,
                status: "ready",
                port: PORT,
            });
        }

        if (pathname === "/api/dialogues" && request.method === "GET") {
            const dialogues = getAllDialogues();
            return sendJson(response, 200, {
                emeraldDir: EMERALD_ROOT,
                dialogues,
                total: dialogues.length,
            });
        }

        if (pathname === "/api/dialogue" && request.method === "POST") {
            const raw = await readRequestBody(request);
            const payload = JSON.parse(raw);
            const updated = saveDialogue(payload);
            return sendJson(response, 200, { ok: true, dialogue: updated });
        }

        if (pathname === "/api/maps" && request.method === "GET") {
            if (fs.existsSync(MAPS_FILE)) {
                return sendFile(response, MAPS_FILE, "application/json");
            }
            return sendJson(response, 200, []);
        }

        if (pathname === "/api/routes" && request.method === "GET") {
            if (fs.existsSync(ROUTES_FILE)) {
                return sendFile(response, ROUTES_FILE, "application/json");
            }
            return sendJson(response, 200, []);
        }

        // Tile proxy: /api/tiles/:map/:z/:x/:y.png
        const tileMatch = pathname.match(/^\/api\/tiles\/([^/]+)\/(\d+)\/(\d+)\/(\d+)\.png$/);
        if (tileMatch && request.method === "GET") {
            const [, mapName, z, x, y] = tileMatch;
            return handleTileRequest(response, mapName, z, x, y);
        }

        // --- STATIC FILES ---
        let relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
        let filePath = path.join(PUBLIC_DIR, relativePath);

        // Security check
        if (!path.resolve(filePath).startsWith(PUBLIC_DIR)) {
            response.writeHead(403, { "Content-Type": "text/plain" });
            return response.end("Forbidden");
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || "application/octet-stream";

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return sendFile(response, filePath, mimeType);
        }

        // Fallback to index.html for SPA
        const indexHtml = path.join(PUBLIC_DIR, "index.html");
        if (fs.existsSync(indexHtml)) {
            return sendFile(response, indexHtml, "text/html; charset=utf-8");
        }

        response.writeHead(404, { "Content-Type": "text/plain" });
        response.end("404 Not Found");
    } catch (err) {
        console.error("Server error:", err);
        sendJson(response, 500, { error: err.message || "Internal Server Error" });
    }
});

server.listen(PORT, HOST, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Emerald Studio is running at: http://${HOST}:${PORT}`);
    console.log(`📂 Emerald Project Root: ${EMERALD_ROOT}`);
    console.log(`🎮 Real-time Map Free-Fly Tester & Dialogue Editor Ready!`);
    console.log(`======================================================\n`);
});
