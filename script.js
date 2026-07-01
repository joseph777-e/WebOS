// GRAVITY - Physics Engine v3.2 

// ── Stars Background ─────────────────────────────────────────────
var starCanvas = document.getElementById('stars');
var sCtx = starCanvas.getContext('2d');

function resizeStars() {
starCanvas.width = window.innerWidth;
starCanvas.height = window.innerHeight;
sCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
for (var i = 0; i < 280; i++) {
var x = Math.random() * starCanvas.width;
var y = Math.random() * starCanvas.height;
var r = Math.random() * 1.3;
var a = Math.random() * 0.7 + 0.1;
sCtx.beginPath();
sCtx.arc(x, y, r, 0, Math.PI * 2);
sCtx.fillStyle = 'rgba(255,255,255,' + a + ')';
sCtx.fill();
}
}

resizeStars();

// ── Sim Canvas ────────────────────────────────────────────────────
var canvas = document.getElementById('sim');
var ctx = canvas.getContext('2d');

function resize() {
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', function() { resize(); resizeStars(); });

// ── Camera ────────────────────────────────────────────────────────
var camera = { x: 0, y: 0, zoom: 1.0, minZoom: 0.1, maxZoom: 5.0 };
var followTarget = null;
var isFollowing = false;

function screenToWorld(sx, sy) {
return {
x: (sx - canvas.width / 2 - camera.x) / camera.zoom,
y: (sy - canvas.height / 2 - camera.y) / camera.zoom
};
}

function updateZoomUI() {
var pct = Math.round(camera.zoom * 100);
document.getElementById('v-zoom').textContent = pct + '%';
document.getElementById('s-zoom').textContent = pct;
var slider = document.querySelector('input[oninput*="zoom"]');
if (slider) slider.value = pct;
}

function changeZoom(factor) {
camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * factor));
updateZoomUI();
}

function resetView() {
camera.x = 0; camera.y = 0; camera.zoom = 1.0;
isFollowing = false; followTarget = null;
updateZoomUI();
updateFollowBtn();
}

function trackCenter() {
if (bodies.length === 0) return;
var tx = 0, ty = 0, totalM = 0;
for (var i = 0; i < bodies.length; i++) {
tx += bodies[i].x * bodies[i].mass;
ty += bodies[i].y * bodies[i].mass;
totalM += bodies[i].mass;
}
if (totalM === 0) return;
camera.x = -(tx / totalM) * camera.zoom;
camera.y = -(ty / totalM) * camera.zoom;
}

function toggleFollow() {
if (!selectedBody) return;
isFollowing = !isFollowing;
followTarget = isFollowing ? selectedBody : null;
updateFollowBtn();
}

function updateFollowBtn() {
var btn = document.getElementById('follow-btn');
if (btn) btn.classList.toggle('active', isFollowing);
var ibtn = document.querySelector('.insp-btn');
if (ibtn) ibtn.classList.toggle('active', isFollowing);
}

function applyFollow() {
if (!isFollowing || !followTarget || followTarget.dead) {
if (isFollowing) { isFollowing = false; updateFollowBtn(); }
return;
}
camera.x = -followTarget.x * camera.zoom;
camera.y = -followTarget.y * camera.zoom;
}

canvas.addEventListener('wheel', function(e) {
e.preventDefault();
var factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
var wx = (e.clientX - canvas.width / 2 - camera.x) / camera.zoom;
var wy = (e.clientY - canvas.height / 2 - camera.y) / camera.zoom;
camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * factor));
camera.x = e.clientX - canvas.width / 2 - wx * camera.zoom;
camera.y = e.clientY - canvas.height / 2 - wy * camera.zoom;
updateZoomUI();
}, { passive: false });

var isPanning = false;
var panStart = { x: 0, y: 0 };
var panCamStart = { x: 0, y: 0 };

canvas.addEventListener('mousedown', function(e) {
if (e.button === 1 || e.button === 2) {
e.preventDefault();
isPanning = true;
isFollowing = false; followTarget = null; updateFollowBtn();
panStart = { x: e.clientX, y: e.clientY };
panCamStart = { x: camera.x, y: camera.y };
canvas.style.cursor = 'grab';
}
});
canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });

// ── State ─────────────────────────────────────────────────────────
var bodies = [];
var particles = [];
var shockwaves = [];
var nebulae = [];
var gravityWells = [];
var paused = false;
var simTime = 0;
var novaCount = 0;
var frameCount = 0;
var G = 1.0;
var damping = 0.999;
var trailLen = 80;
var spawnType = 'planet';
var spawnMode = 'launch';
var customRadius = 0;
var customMass = 0;
var timeWarp = 1.0;
var wellStrength = 500;

// ── Selection ─────────────────────────────────────────────────────
var selectedBody = null;

function selectBody(body) {
selectedBody = body;
followTarget = isFollowing ? body : null;
updateInspector();
document.getElementById('inspector').classList.remove('hidden');
}

function deselectBody() {
selectedBody = null;
isFollowing = false; followTarget = null;
updateFollowBtn();
document.getElementById('inspector').classList.add('hidden');
}

function deleteSelected() {
if (!selectedBody) return;
selectedBody.dead = true;
var nb = [];
for (var i = 0; i < bodies.length; i++) {
if (!bodies[i].dead) nb.push(bodies[i]);
}
bodies = nb;
deselectBody();
}

function updateInspector() {
if (!selectedBody) return;
var b = selectedBody;
var icons = { planet: '🪐', star: '⭐', blackhole: '🕳️', comet: '☄️', asteroid: '🪨', pulsar: '💫' };
var spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
var period = '—';
var nearestMass = 0, nearestDist = Infinity;
for (var i = 0; i < bodies.length; i++) {
if (bodies[i] === b) continue;
var dx = bodies[i].x - b.x, dy = bodies[i].y - b.y;
var d = Math.sqrt(dx * dx + dy * dy);
if (d < nearestDist && bodies[i].mass > b.mass) { nearestDist = d; nearestMass = bodies[i].mass; }
}
if (nearestMass > 0 && nearestDist < 1000) {
var T = 2 * Math.PI * Math.sqrt(Math.pow(nearestDist, 3) / (G * nearestMass));
period = T.toFixed(0) + ' u';
}
var classStr = b.starClass ? ' (' + b.starClass + ')' : '';
document.getElementById('inspector-icon').textContent = icons[b.type] || '●';
document.getElementById('inspector-title').textContent = b.type.toUpperCase() + classStr;
document.getElementById('inspector-body').innerHTML =
'<div class="stat-row"><span>MASS</span><span class="stat-val">' + b.mass.toFixed(1) + '</span></div>' +
'<div class="stat-row"><span>RADIUS</span><span class="stat-val">' + b.radius.toFixed(1) + '</span></div>' +
'<div class="stat-row"><span>SPEED</span><span class="stat-val">' + spd.toFixed(2) + ' u/s</span></div>' +
'<div class="stat-row"><span>POS X</span><span class="stat-val">' + b.x.toFixed(0) + '</span></div>' +
'<div class="stat-row"><span>POS Y</span><span class="stat-val">' + b.y.toFixed(0) + '</span></div>' +
'<div class="stat-row"><span>PERIOD</span><span class="stat-val">' + period + '</span></div>' +
(b.hasRings ? '<div class="stat-row"><span>RINGS</span><span class="stat-val">YES</span></div>' : '') +
(b.starClass ? '<div class="stat-row"><span>CLASS</span><span class="stat-val">' + b.starClass + '</span></div>' : '');
var mult = (b.gravityMult !== undefined) ? b.gravityMult : 1.0;
document.getElementById('slider-bodygravity').value = Math.round(mult * 10);
document.getElementById('v-bodygravity').textContent = mult.toFixed(1) + 'x';
}

function setBodyGravity(val) {
if (!selectedBody) return;
var mult = parseFloat(val) / 10;
selectedBody.gravityMult = mult;
document.getElementById('v-bodygravity').textContent = mult.toFixed(1) + 'x';
}

function bodyAtScreen(sx, sy) {
var world = screenToWorld(sx, sy);
var best = null, bestDist = Infinity;
for (var i = 0; i < bodies.length; i++) {
var dx = bodies[i].x - world.x, dy = bodies[i].y - world.y;
var dist = Math.sqrt(dx * dx + dy * dy);
var hitRadius = Math.max(bodies[i].radius, 10 / camera.zoom);
if (dist < hitRadius && dist < bestDist) { best = bodies[i]; bestDist = dist; }
}
return best;
}

// ── Star Classes ──────────────────────────────────────────────────
var starClasses = ['M', 'K', 'G', 'F', 'A', 'B', 'O'];
var starClassColors = {
'M': 'hsl(10,80%,55%)', 'K': 'hsl(25,85%,60%)', 'G': 'hsl(48,100%,70%)',
'F': 'hsl(55,90%,80%)', 'A': 'hsl(200,30%,90%)', 'B': 'hsl(215,80%,80%)', 'O': 'hsl(225,100%,75%)'
};
var starClassGlows = {
'M': '#ff4422', 'K': '#ff8833', 'G': '#ffcc00',
'F': '#ffe880', 'A': '#ccddff', 'B': '#88aaff', 'O': '#4466ff'
};
var starClassMassMin = { 'M': 80, 'K': 150, 'G': 250, 'F': 350, 'A': 450, 'B': 600, 'O': 800 };
var starClassMassMax = { 'M': 150, 'K': 250, 'G': 350, 'F': 450, 'A': 600, 'B': 800, 'O': 1200 };
var starClassRadiusMin = { 'M': 8, 'K': 10, 'G': 13, 'F': 15, 'A': 17, 'B': 19, 'O': 22 };
var starClassRadiusMax = { 'M': 11, 'K': 13, 'G': 16, 'F': 18, 'A': 20, 'B': 23, 'O': 28 };

function randomStarClass() {
var weights = [40, 25, 15, 8, 5, 4, 3];
var total = 0;
for (var i = 0; i < weights.length; i++) total += weights[i];
var roll = Math.random() * total, sum = 0;
for (var j = 0; j < weights.length; j++) { sum += weights[j]; if (roll < sum) return starClasses[j]; }
return 'G';
}

// ── Body Constructor ──────────────────────────────────────────────
function getRadius(type, sc) {
if (customRadius > 0) return customRadius;
if (type === 'planet') return 5 + Math.random() * 9;
if (type === 'star') return starClassRadiusMin[sc || 'G'] + Math.random() * (starClassRadiusMax[sc || 'G'] - starClassRadiusMin[sc || 'G']);
if (type === 'blackhole') return 13 + Math.random() * 7;
if (type === 'comet') return 2 + Math.random() * 3;
if (type === 'asteroid') return 2 + Math.random() * 2;
if (type === 'pulsar') return 7;
return 8;
}

function getMass(type, sc) {
if (customMass > 0) return customMass;
if (type === 'planet') return 5 + Math.random() * 12;
if (type === 'star') return starClassMassMin[sc || 'G'] + Math.random() * (starClassMassMax[sc || 'G'] - starClassMassMin[sc || 'G']);
if (type === 'blackhole') return 500 + Math.random() * 600;
if (type === 'comet') return 1 + Math.random() * 2;
if (type === 'asteroid') return 0.5 + Math.random() * 1.5;
if (type === 'pulsar') return 200;
return 10;
}

function getColor(type, sc) {
if (type === 'planet') return 'hsl(' + (180 + Math.random() * 100) + ',' + (50 + Math.random() * 30) + '%,' + (45 + Math.random() * 25) + '%)';
if (type === 'star') return starClassColors[sc || 'G'];
if (type === 'blackhole') return '#111';
if (type === 'comet') return 'hsl(' + (160 + Math.random() * 40) + ',80%,75%)';
if (type === 'asteroid') return 'hsl(' + (20 + Math.random() * 20) + ',' + (15 + Math.random() * 15) + '%,' + (40 + Math.random() * 20) + '%)';
if (type === 'pulsar') return '#aaddff';
return '#ffffff';
}

function getGlow(type, sc) {
if (type === 'planet') return '#4488ff';
if (type === 'star') return starClassGlows[sc || 'G'];
if (type === 'blackhole') return '#9900ff';
if (type === 'comet') return '#00ffcc';
if (type === 'asteroid') return '#886644';
if (type === 'pulsar') return '#00ccff';
return '#ffffff';
}

function shouldHaveRings(body) {
return body.type === 'planet' && body.mass > 10 && Math.random() < 0.35;
}

function Body(x, y, vx, vy, type) {
this.x = x; this.y = y; this.vx = vx; this.vy = vy;
this.type = type;
this.starClass = (type === 'star') ? randomStarClass() : null;
this.radius = getRadius(type, this.starClass);
this.mass = getMass(type, this.starClass);
this.color = getColor(type, this.starClass);
this.glow = getGlow(type, this.starClass);
this.trail = [];
this.dead = false;
this.isHeavy = (type === 'star' || type === 'blackhole' || type === 'pulsar');
this.gravityMult = 1.0;
this.hasRings = false; this.ringTilt = 0; this.ringColor = '';
this.nearestStarAngle = 0;
// Pulsar-specific
this.pulsarAngle = 0;
this.pulsarPhase = 0;
}

// ── Particle Constructor ──────────────────────────────────────────
function Particle(x, y, vx, vy, color, life, size) {
this.x = x; 
this.y = y; 
this.vx = vx; 
this.vy = vy;
this.color = color; 
this.life = life; 
this.maxLife = life; 
this.size = size;
}                       
Particle.prototype.update = function(dt) {
this.x += this.vx * dt; this.y += this.vy * dt;
this.vx *= 0.97; this.vy *= 0.97; this.life -= dt;
};
Particle.prototype.isAlive = function() { return this.life > 0; };
Particle.prototype.alpha = function() { return Math.max(0, this.life / this.maxLife); };

// ── Shockwave Constructor ─────────────────────────────────────────
function Shockwave(x, y, maxR, color) {
this.x = x; this.y = y; this.r = 0; this.maxR = maxR;
this.color = color; this.life = 1;
}
Shockwave.prototype.update = function(dt) { this.r += dt * 8; this.life = 1 - (this.r / this.maxR); };
Shockwave.prototype.isAlive = function() { return this.life > 0; };

// ── Nebula Constructor ────────────────────────────────────────────
function Nebula(x, y, color) {
this.x = x; this.y = y; this.color = color; this.life = 1.0;
this.maxRadius = 80 + Math.random() * 60; this.clouds = [];
for (var i = 0; i < 12; i++) {
this.clouds.push({ ox: (Math.random() - 0.5) * this.maxRadius * 1.2, oy: (Math.random() - 0.5) * this.maxRadius * 1.2, r: 15 + Math.random() * 35 });
}
}

Nebula.prototype.update = function(dt) { this.life -= dt * 0.003; };
Nebula.prototype.isAlive = function() { return this.life > 0; };

// ── Gravity Well ──────────────────────────────────────────────────
function GravityWell(x, y, strength) {
this.x = x; this.y = y; this.strength = strength; this.active = true;
}

// ── Event Details ─────────────────────────────────────────────────
function showEventDetail(type, data) {
var icon = '', title = '', body = '';
if (type === 'supernova') {
icon = '💥'; title = 'SUPERNOVA';
body = '<strong>Type II Supernova</strong><br>Two stars collided, exceeding the Tolman-Oppenheimer-Volkoff limit.<br><br>'
+ 'Combined mass: <strong>' + (data.mass ? Math.round(data.mass) : '?') + ' units</strong><br>'
+ 'The explosion releases more energy than the Sun emits in its entire lifetime. A neutron star remnant has formed.';
} else if (type === 'tidal') {
icon = '🌀'; title = 'TIDAL DISRUPTION EVENT';
body = '<strong>Tidal Disruption Event (TDE)</strong><br>A star was torn apart by the tidal forces of the black hole, forming a bright accretion disk of X-ray flares.<br><br>'
+ 'New black hole mass: <strong>' + (data.mass ? Math.round(data.mass) : '?') + ' units</strong>';
} else if (type === 'roche') {
icon = '💫'; title = 'ROCHE LIMIT EXCEEDED';
body = '<strong>Roche Limit Tidal Disruption</strong><br>Within the Roche limit, tidal forces exceed the bodys self-gravity, tearing it apart into debris.<br><br>This is how the rings of Saturn actually formed.';
} else if (type === 'merge') {
icon = '🔵'; title = 'PLANETARY MERGER';
body = '<strong>Accretionary Collision</strong><br>Two bodies merged. This is how planets form through accretion over millions of years.<br><br>'
+ 'New mass: <strong>' + (data.mass ? Math.round(data.mass) : '?') + ' units</strong>';
} else if (type === 'orbit') {
icon = '🪐'; title = 'ORBIT ESTABLISHED';
body = '<strong>Stable Keplerian Orbit</strong><br>'
+ 'Radius: <strong>' + (data.dist ? Math.round(data.dist) : '?') + ' units</strong><br>'
+ 'Velocity: <strong>' + (data.speed ? data.speed.toFixed(2) : '?') + ' u/s</strong><br><br>'
+ 'Third Law of Kepler: T² ∝ a³';
} else if (type === 'neutron') {
icon = '🌑'; title = 'NEUTRON STAR FORMED';
body = '<strong>Neutron Star Remnant</strong><br>The collapsed core of a supernova. A teaspoon would weigh ~10 billion tonnes on Earth.';
} else if (type === 'absorbed') {
icon = '🕳️'; title = 'GRAVITATIONAL ABSORPTION';
body = '<strong>Event Horizon Crossing</strong><br>Nothing — not even light — escapes once inside.<br><br>'
+ 'New black hole mass: <strong>' + (data.mass ? Math.round(data.mass) : '?') + ' units</strong>';
} else if (type === 'starclass') {
var classDesc = {
'M': 'Red Dwarf — most common stars. Small, cool, and extremely long-lived (trillions of years).',
'K': 'Orange Dwarf — slightly larger than red dwarfs. Stable output, ideal for habitable planets.',
'G': 'Yellow Dwarf — our Sun is a G-type. Medium mass, ~10 billion year lifespan.',
'F': 'Yellow-White Star — hotter and brighter than the Sun. Lifespan 3-7 billion years.',
'A': 'White Star — very bright and hot. Only 1-3 billion year lifespan.',
'B': 'Blue-White Giant — extremely luminous. Burns out in 10-100 million years.',
'O': 'Blue Supergiant — rarest and most massive. Lifespan of only 1-3 million years before a violent supernova.'
};
icon = '⭐'; title = 'STAR SPAWNED — CLASS ' + (data.cls || '?');
body = classDesc[data.cls] || 'Unknown class.';
} else if (type === 'pulsar') {
icon = '💫'; title = 'PULSAR SYSTEM';
body = '<strong>Millisecond Pulsar</strong><br>A rapidly rotating neutron star emitting beams of electromagnetic radiation. '
+ 'Pulsars spin hundreds of times per second and are among the most precise clocks in the universe.<br><br>'
+ 'The beams sweep space like a cosmic lighthouse, visible only when aimed at Earth.';
}
document.getElementById('event-detail-icon').textContent = icon;
document.getElementById('event-detail-title').textContent = title;
document.getElementById('event-detail-body').innerHTML = body;
document.getElementById('event-detail').classList.remove('hidden');
}

function closeDetail() {
document.getElementById('event-detail').classList.add('hidden');
}

// ── Event Log ─────────────────────────────────────────────────────
function logEvent(msg, detailType, detailData) {
var log = document.getElementById('eventlog');
var el = document.createElement('div');
el.className = 'event-item';
el.textContent = msg;
if (detailType) {
el.style.cursor = 'pointer';
(function(t, d) { el.addEventListener('click', function() { showEventDetail(t, d || {}); }); })(detailType, detailData);
}
log.appendChild(el);
while (log.children.length > 6) log.removeChild(log.firstChild);
setTimeout(function() { el.classList.add('fade'); }, 3500);
setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 6000);
}

// ── Supernova ─────────────────────────────────────────────────────
function triggerSupernova(x, y, mass, color) {
novaCount++;
logEvent('💥 SUPERNOVA', 'supernova', { x: x, y: y, mass: mass });
var flash = document.getElementById('flash');
flash.style.opacity = '0.4';
setTimeout(function() { flash.style.opacity = '0'; }, 130);
shockwaves.push(new Shockwave(x, y, mass * 3.5, '#fff8e0'));
shockwaves.push(new Shockwave(x, y, mass * 2.5, '#ff8800'));
shockwaves.push(new Shockwave(x, y, mass * 1.5, '#ff2200'));
nebulae.push(new Nebula(x, y, color || '#ff6600'));
nebulae.push(new Nebula(x, y, '#4466ff'));
var i, angle, speed, hue;
var count = Math.min(60, Math.floor(40 + mass * 0.1));
for (i = 0; i < count; i++) {
angle = Math.random() * Math.PI * 2; speed = 1 + Math.random() * 10;
hue = Math.random() < 0.5 ? 'hsl(' + (20 + Math.random() * 40) + ',100%,70%)' : 'hsl(' + (200 + Math.random() * 60) + ',80%,80%)';
particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, hue, 70 + Math.random() * 80, 1 + Math.random() * 3));
}
for (i = 0; i < 25; i++) {
var a2 = Math.random() * Math.PI * 2, s2 = 5 + Math.random() * 14;
particles.push(new Particle(x, y, Math.cos(a2) * s2, Math.sin(a2) * s2, '#ffffff', 50 + Math.random() * 40, 0.8));
}
setTimeout(function() {
var remnant = new Body(x, y, 0, 0, 'blackhole');
remnant.mass = mass * 0.4;
remnant.radius = Math.max(8, mass * 0.06);
bodies.push(remnant);
logEvent('🌑 NEUTRON STAR FORMED', 'neutron', {});
}, 450);
}

// ── Roche Limit ───────────────────────────────────────────────────
function checkRocheLimit(i, j) {
var a = bodies[i], b = bodies[j];
if (a.dead || b.dead) return false;
var bigger, smaller;
if (a.mass > b.mass * 5) { bigger = a; smaller = b; }
else if (b.mass > a.mass * 5) { bigger = b; smaller = a; }
else return false;
var dx = smaller.x - bigger.x, dy = smaller.y - bigger.y;
var dist = Math.sqrt(dx * dx + dy * dy);
var rocheLimit = bigger.radius * 2.44 * Math.pow(bigger.mass / smaller.mass, 1 / 3);
if (dist < rocheLimit && dist > bigger.radius + smaller.radius) {
return { bigger: bigger, smaller: smaller };
}
return false;
}

function triggerRocheTeardown(smaller, bigger) {
smaller.dead = true;
var nb = [];
for (var k = 0; k < bodies.length; k++) { if (!bodies[k].dead) nb.push(bodies[k]); }
bodies = nb;
logEvent('💫 ROCHE LIMIT — TORN APART', 'roche', {});
var count = Math.min(6, 3 + Math.floor(smaller.mass * 0.2));
for (var i = 0; i < count; i++) {   
var baseAngle = Math.atan2(smaller.y - bigger.y, smaller.x - bigger.x);
var spread = (Math.random() - 0.5) * Math.PI * 0.6;
var angle = baseAngle + spread;
var speed = 0.8 + Math.random() * 2.5;
var debris = new Body(
smaller.x + (Math.random() - 0.5) * smaller.radius * 3,
smaller.y + (Math.random() - 0.5) * smaller.radius * 3,
smaller.vx + Math.cos(angle) * speed, smaller.vy + Math.sin(angle) * speed, 'asteroid'
);

}
for (var j = 0; j < 20; j++) {
var pa = Math.random() * Math.PI * 2, ps = 1 + Math.random() * 3;
particles.push(new Particle(smaller.x, smaller.y, Math.cos(pa) * ps, Math.sin(pa) * ps, smaller.color, 25 + Math.random() * 25, 1 + Math.random() * 2));

}
}





// ── Collision ─────────────────────────────────────────────────────
function handleCollision(i, j) {
var a = bodies[i], b = bodies[j];
if (a.dead || b.dead) return;
var bothStars = (a.type === 'star' && b.type === 'star');
var starHitsBH = (a.type === 'star' && b.type === 'blackhole') || (a.type === 'blackhole' && b.type === 'star');
var totalMass = a.mass + b.mass;
var nx = (a.x * a.mass + b.x * b.mass) / totalMass;
var ny = (a.y * a.mass + b.y * b.mass) / totalMass;
var nvx = (a.vx * a.mass + b.vx * b.mass) / totalMass;
var nvy = (a.vy * a.mass + b.vy * b.mass) / totalMass;
a.dead = true; b.dead = true;
if (selectedBody === a || selectedBody === b) deselectBody();
var nb = [];
for (var k = 0; k < bodies.length; k++) { if (!bodies[k].dead) nb.push(bodies[k]); }
bodies = nb;

if (bothStars) {
triggerSupernova(nx, ny, totalMass, a.color);
} else if (starHitsBH) {
logEvent('🌀 TIDAL DISRUPTION', 'tidal', { mass: totalMass });
var bh = (a.type === 'blackhole') ? a : b;
var newBH = new Body(nx, ny, nvx, nvy, 'blackhole');
newBH.mass = totalMass; newBH.radius = Math.cbrt(Math.pow(bh.radius, 3) + 60);
for (var p = 0; p < 50; p++) {
var pa2 = Math.random() * Math.PI * 2, ps2 = 2 + Math.random() * 6;
particles.push(new Particle(nx, ny, Math.cos(pa2) * ps2, Math.sin(pa2) * ps2, 'hsl(' + (280 + Math.random() * 60) + ',100%,70%)', 60 + Math.random() * 60, 1.5));
}
bodies.push(newBH);
} else {
var bigger = (a.mass >= b.mass) ? a : b;
var smaller = (a.mass < b.mass) ? a : b;
var merged = new Body(nx, ny, nvx, nvy, bigger.type);
merged.mass = totalMass;
merged.radius = Math.cbrt(Math.pow(a.radius, 3) + Math.pow(b.radius, 3));
merged.color = bigger.color; merged.glow = bigger.glow; merged.starClass = bigger.starClass;
if (merged.type === 'planet' && merged.mass > 12) { merged.hasRings = true; merged.ringTilt = Math.random() * 0.5 + 0.1; merged.ringColor = bigger.color; }
for (var sp = 0; sp < 20; sp++) {
var sa = Math.random() * Math.PI * 2, ss = 1 + Math.random() * 4;
particles.push(new Particle(nx, ny, Math.cos(sa) * ss, Math.sin(sa) * ss, smaller.color, 20 + Math.random() * 30, 1 + Math.random() * 2));
}
if (bigger.type === 'blackhole') logEvent('🕳️ BH ABSORBED BODY', 'absorbed', { mass: totalMass });
else logEvent('🔵 BODIES MERGED', 'merge', { mass: totalMass, radius: merged.radius });
bodies.push(merged);
}
}

// ── Orbit Helper ──────────────────────────────────────────────────
function spawnInOrbit(screenX, screenY, type) {
var world = screenToWorld(screenX, screenY);
var x = world.x, y = world.y;
var nearest = null, nearestDist = Infinity;
for (var i = 0; i < bodies.length; i++) {
var dx = bodies[i].x - x, dy = bodies[i].y - y;
var dist = Math.sqrt(dx * dx + dy * dy);
if (dist < nearestDist && bodies[i].mass > 20) { nearest = bodies[i]; nearestDist = dist; }
}
if (!nearest || nearestDist < nearest.radius * 1.5) {
bodies.push(new Body(x, y, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, type));
return;
}
var ddx = x - nearest.x, ddy = y - nearest.y;
var d = Math.sqrt(ddx * ddx + ddy * ddy);
var speed = Math.sqrt(G * nearest.mass / d) * 0.98;
var vx = (-ddy / d) * speed + nearest.vx;
var vy = (ddx / d) * speed + nearest.vy;
var nb = new Body(x, y, vx, vy, type);
if (nb.type === 'planet' && shouldHaveRings(nb)) { nb.hasRings = true; nb.ringTilt = Math.random() * 0.5 + 0.1; nb.ringColor = nb.color; }
bodies.push(nb);
logEvent('🪐 ORBIT INSERTED', 'orbit', { dist: d, speed: speed });
}
// ── Day/Night ─────────────────────────────────────────────────────
function updateDayNight() {
var i, j, b, star, dx, dy, dist, bestDist;
for (i = 0; i < bodies.length; i++) {
b = bodies[i];
if (b.type !== 'planet') continue;
bestDist = Infinity;
for (j = 0; j < bodies.length; j++) {
star = bodies[j];
if (star.type !== 'star') continue;
dx = star.x - b.x; dy = star.y - b.y; dist = Math.sqrt(dx * dx + dy * dy);
if (dist < bestDist) { bestDist = dist; b.nearestStarAngle = Math.atan2(dy, dx); }
}
}
}

// ── Physics Step ──────────────────────────────────────────────────
function step(dt) {
if (paused) return;
dt = dt * timeWarp;
simTime += dt * 0.016;
var i, j, b, bb, a, dx, dy, dist2, minDist, dist, force, fx, fy;

for (i = 0; i < bodies.length; i++) {
b = bodies[i];
b.trail.push({ x: b.x, y: b.y });
if (b.trail.length > trailLen) b.trail.shift();
// Advance pulsar rotation
if (b.type === 'pulsar') {
b.pulsarAngle += dt * 0.18;
b.pulsarPhase += dt * 0.05;
}
}

for (i = 0; i < bodies.length; i++) {
fx = 0; fy = 0;
a = bodies[i];
if (a.dead) continue;

for (j = 0; j < bodies.length; j++) {
if (i === j) continue;
bb = bodies[j]; if (bb.dead) continue;
dx = bb.x - a.x; dy = bb.y - a.y; dist2 = dx * dx + dy * dy;

// FIX: use 0.85 instead of 1.05 so planets need real overlap before merging
minDist = (a.radius + bb.radius) * 0.85;
if (dist2 < minDist * minDist) {
if (!a.dead && !bb.dead) { handleCollision(i, j); return; }
continue;
}
var rocheResult = checkRocheLimit(i, j);
if (rocheResult) { triggerRocheTeardown(rocheResult.smaller, rocheResult.bigger); return; }
var softening = 100;
dist = Math.sqrt(dist2 + softening);
force = G * a.mass * bb.mass / (dist2 + softening);
force *= bb.gravityMult;
fx += force * dx / dist; fy += force * dy / dist;
}

for (j = 0; j < gravityWells.length; j++) {
var well = gravityWells[j];
dx = well.x - a.x; dy = well.y - a.y; dist2 = dx * dx + dy * dy;
var softDist = Math.sqrt(dist2 + 100);
var wforce = well.strength * a.mass / (dist2 + 100);
fx += wforce * dx / softDist; fy += wforce * dy / softDist;
}

if (a.isHeavy) {
var dominantPull = false;
for (var jj = 0; jj < bodies.length; jj++) {
if (jj === i) continue;
var bbb = bodies[jj];
if (bbb.mass >= a.mass * 0.3) { dominantPull = true; break; }
}
if (!dominantPull) {
a.vx = 0; a.vy = 0; fx = 0; fy = 0;
} else {
fx *= 0.4; fy *= 0.4;
}
}
a.vx += (fx / a.mass) * dt; a.vy += (fy / a.mass) * dt;
a.vx *= damping; a.vy *= damping;
}

for (i = 0; i < bodies.length; i++) { bodies[i].x += bodies[i].vx * dt; bodies[i].y += bodies[i].vy * dt; }

var aliveP = [];
for (i = 0; i < particles.length; i++) { particles[i].update(dt); if (particles[i].isAlive()) aliveP.push(particles[i]); }
particles = aliveP;

var aliveW = [];
for (i = 0; i < shockwaves.length; i++) { shockwaves[i].update(dt); if (shockwaves[i].isAlive()) aliveW.push(shockwaves[i]); }
shockwaves = aliveW;

var aliveN = [];
for (i = 0; i < nebulae.length; i++) { nebulae[i].update(dt); if (nebulae[i].isAlive()) aliveN.push(nebulae[i]); }
nebulae = aliveN;

var escapeMargin = 4000;
var survivingBodies = [];
for (i = 0; i < bodies.length; i++) {
b = bodies[i];
if (b.x > -escapeMargin && b.x < escapeMargin && b.y > -escapeMargin && b.y < escapeMargin) survivingBodies.push(b);
else if (b === selectedBody) deselectBody();
}
if (survivingBodies.length > 120) {
survivingBodies.sort(function(a, bb) { return bb.mass - a.mass; });
survivingBodies = survivingBodies.slice(0, 120);
if (selectedBody && survivingBodies.indexOf(selectedBody) === -1) deselectBody();
}
bodies = survivingBodies;

if (frameCount % 30 === 0) updateDayNight();
}

// ── Helpers ───────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
if (!hex) return 'rgba(200,200,200,' + alpha + ')';
if (hex.indexOf('hsl') === 0) return hex.replace('hsl(', 'hsla(').replace(')', ',' + alpha + ')');
if (hex === '#111' || hex === '#000') return 'rgba(10,10,10,' + alpha + ')';
if (hex.charAt(0) === '#' && hex.length === 7) {
var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), bv = parseInt(hex.slice(5, 7), 16);
return 'rgba(' + r + ',' + g + ',' + bv + ',' + alpha + ')';
}
return 'rgba(200,200,200,' + alpha + ')';
}

function lighten(color) {
    if (color.indexOf('hsl') === 0) {
        return color.replace(/(\d+)%\)$/, function(m, p) {
            return Math.min(100, parseInt(p) + 22) + '%)';
        });
    }
    return color;
}

// ── Draw Rings ────────────────────────────────────────────────────
function drawRings(b) {
var tilt = b.ringTilt || 0.25;
var innerR = b.radius * 1.5, outerR = b.radius * 2.6;
var color = b.ringColor || b.color;
ctx.save(); ctx.translate(b.x, b.y); ctx.scale(1, tilt);
ctx.beginPath(); ctx.arc(0, 0, outerR, 0, Math.PI * 2);
ctx.strokeStyle = hexToRgba(color, 0.35); ctx.lineWidth = (outerR - innerR) * 0.5; ctx.stroke();
ctx.beginPath(); ctx.arc(0, 0, innerR + (outerR - innerR) * 0.25, 0, Math.PI * 2);
ctx.strokeStyle = hexToRgba(color, 0.2); ctx.lineWidth = (outerR - innerR) * 0.35; ctx.stroke();
ctx.restore();
}

// ── Draw Lensing ──────────────────────────────────────────────────
function drawLensing(b) {
if (b.type !== 'blackhole') return;
var lensR = b.radius * 5;
for (var s = 0; s < 3; s++) {
var fr = (s + 1) / 3;
var ringR = b.radius * 2.5 + fr * (lensR - b.radius * 2.5);
ctx.beginPath(); ctx.arc(b.x, b.y, ringR, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(180,100,255,' + ((1 - fr) * 0.12) + ')';
ctx.lineWidth = (1 + (1 - fr) * 3) / camera.zoom; ctx.stroke();
}
ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 3.2, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2 / camera.zoom; ctx.stroke();
}

// ── Draw Pulsar Beams ─────────────────────────────────────────────
function drawPulsarBeams(b) {
var beamLen = 160;
var beamWidth = 8;
// Two opposite beams that rotate
for (var beam = 0; beam < 2; beam++) {
var angle = b.pulsarAngle + beam * Math.PI;
var pulse = 0.4 + 0.6 * Math.abs(Math.sin(b.pulsarPhase * 6 + beam * Math.PI));
var grad = ctx.createLinearGradient(
b.x, b.y,
b.x + Math.cos(angle) * beamLen,
b.y + Math.sin(angle) * beamLen
);
grad.addColorStop(0, 'rgba(100,220,255,' + (0.9 * pulse) + ')');
grad.addColorStop(0.3, 'rgba(60,160,255,' + (0.5 * pulse) + ')');
grad.addColorStop(1, 'rgba(0,80,200,0)');
ctx.save();
ctx.beginPath();
ctx.moveTo(b.x, b.y);
ctx.lineTo(b.x + Math.cos(angle) * beamLen, b.y + Math.sin(angle) * beamLen);
ctx.strokeStyle = grad;
ctx.lineWidth = beamWidth * pulse / camera.zoom;
ctx.lineCap = 'round';
ctx.stroke();
ctx.restore();
}
// Pulsing glow ring
var glowPulse = 0.3 + 0.7 * Math.abs(Math.sin(b.pulsarPhase * 6));
ctx.beginPath();
ctx.arc(b.x, b.y, b.radius * 2.5, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(0,200,255,' + (0.4 * glowPulse) + ')';
ctx.lineWidth = 3 / camera.zoom;
ctx.stroke();
}

// ── Draw Nebula ───────────────────────────────────────────────────
function drawNebula(n) {
var alpha = n.life * 0.18;
for (var c = 0; c < n.clouds.length; c++) {
var cloud = n.clouds[c];
var gr = ctx.createRadialGradient(n.x + cloud.ox, n.y + cloud.oy, 0, n.x + cloud.ox, n.y + cloud.oy, cloud.r * (2 - n.life));
gr.addColorStop(0, hexToRgba(n.color, alpha * 0.8));
gr.addColorStop(1, hexToRgba(n.color, 0));
ctx.beginPath(); ctx.arc(n.x + cloud.ox, n.y + cloud.oy, cloud.r * (2 - n.life), 0, Math.PI * 2);
ctx.fillStyle = gr; ctx.fill();
}
}

// ── Draw Day/Night ────────────────────────────────────────────────
function drawDayNight(b) {
if (b.nearestStarAngle === undefined) return;
var angle = b.nearestStarAngle;
var ng = ctx.createRadialGradient(b.x - Math.cos(angle) * b.radius * 0.3, b.y - Math.sin(angle) * b.radius * 0.3, b.radius * 0.1, b.x, b.y, b.radius);
ng.addColorStop(0, 'rgba(0,0,0,0)'); ng.addColorStop(0.6, 'rgba(0,0,0,0)'); ng.addColorStop(1, 'rgba(0,0,20,0.55)');
ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fillStyle = ng; ctx.fill();
}

// ── Draw Gravity Well ─────────────────────────────────────────────
function drawGravityWells() {
for (var i = 0; i < gravityWells.length; i++) {
var w = gravityWells[i];
var t = simTime * 2;
for (var ring = 0; ring < 4; ring++) {
var rr = 15 + ring * 18 + (t % 18);
var al = (1 - ring / 4) * 0.4;
ctx.beginPath(); ctx.arc(w.x, w.y, rr / camera.zoom, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(255,153,68,' + al + ')';
ctx.lineWidth = 1.5 / camera.zoom; ctx.stroke();
}
ctx.beginPath(); ctx.arc(w.x, w.y, 6 / camera.zoom, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(255,153,68,0.8)'; ctx.fill();
}
}

// ── Render ────────────────────────────────────────────────────────
function draw() {
ctx.fillStyle = 'rgba(2,2,10,0.18)';
ctx.fillRect(0, 0, canvas.width, canvas.height);

applyFollow();

ctx.save();
ctx.translate(canvas.width / 2 + camera.x, canvas.height / 2 + camera.y);
ctx.scale(camera.zoom, camera.zoom);

var i, s, p, b, t, grad, bodyGrad, glowR, lw;

for (i = 0; i < nebulae.length; i++) drawNebula(nebulae[i]);

for (i = 0; i < shockwaves.length; i++) {
s = shockwaves[i];
ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
ctx.strokeStyle = hexToRgba(s.color, s.life * 0.7);
ctx.lineWidth = (3 * s.life) / camera.zoom; ctx.stroke();
}

for (i = 0; i < particles.length; i++) {
p = particles[i];
ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
ctx.fillStyle = p.color.indexOf('hsl') === 0
? p.color.replace('hsl(', 'hsla(').replace(')', ',' + p.alpha() + ')')
: 'rgba(255,255,255,' + p.alpha() + ')';
ctx.fill();
}

// Rings back half
for (i = 0; i < bodies.length; i++) {
b = bodies[i];
if (b.hasRings) { ctx.save(); ctx.globalAlpha = 0.5; drawRings(b); ctx.restore(); }
}

// Bodies
for (i = 0; i < bodies.length; i++) {
b = bodies[i];
if (b.type === 'blackhole') drawLensing(b);
if (b.type === 'pulsar') drawPulsarBeams(b);

if (b.trail.length > 1 && trailLen > 0) {
for (t = 1; t < b.trail.length; t++) {
var ta = (t / b.trail.length) * 0.45;
lw = Math.max(0.5, (t / b.trail.length) * b.radius * 0.35);
ctx.beginPath(); ctx.moveTo(b.trail[t - 1].x, b.trail[t - 1].y); ctx.lineTo(b.trail[t].x, b.trail[t].y);
ctx.strokeStyle = hexToRgba(b.glow, ta); ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
}
}

glowR = b.radius * (b.type === 'blackhole' ? 3 : 4);
grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, glowR);
grad.addColorStop(0, hexToRgba(b.glow, b.type === 'blackhole' ? 0.3 : 0.25));
grad.addColorStop(1, hexToRgba(b.glow, 0));
ctx.beginPath(); ctx.arc(b.x, b.y, glowR, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();

bodyGrad = ctx.createRadialGradient(b.x - b.radius * 0.3, b.y - b.radius * 0.3, 0, b.x, b.y, b.radius);
if (b.type === 'blackhole') {
bodyGrad.addColorStop(0, '#333'); bodyGrad.addColorStop(0.4, '#111'); bodyGrad.addColorStop(1, '#000');
} else {
bodyGrad.addColorStop(0, lighten(b.color)); bodyGrad.addColorStop(1, b.color);
}
ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fillStyle = bodyGrad; ctx.fill();

if (b.type === 'planet') drawDayNight(b);

if (b.type === 'blackhole') {
ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 1.7, 0, Math.PI * 2);
ctx.strokeStyle = hexToRgba('#9900ff', 0.45); ctx.lineWidth = 2 / camera.zoom; ctx.stroke();
ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 2.3, 0, Math.PI * 2);
ctx.strokeStyle = hexToRgba('#cc44ff', 0.2); ctx.lineWidth = 1 / camera.zoom; ctx.stroke();
}

if (b.type === 'star') {
var flicker = 0.7 + Math.sin(simTime * 3 + b.x) * 0.3;
var corona = ctx.createRadialGradient(b.x, b.y, b.radius, b.x, b.y, b.radius * 2.5);
corona.addColorStop(0, hexToRgba(b.glow, 0.14 * flicker)); corona.addColorStop(1, hexToRgba(b.glow, 0));
ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 2.5, 0, Math.PI * 2); ctx.fillStyle = corona; ctx.fill();
if (camera.zoom > 1.5 && b.starClass) {
ctx.fillStyle = 'rgba(255,255,255,0.55)';
ctx.font = (b.radius * 0.7) + 'px Space Mono, monospace';
ctx.textAlign = 'center';
ctx.fillText(b.starClass, b.x, b.y + b.radius + 10 / camera.zoom);
}
}

if (b.type === 'comet') {
var cspeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
if (cspeed > 0.01) {
var ctx_tx = -b.vx / cspeed, ctx_ty = -b.vy / cspeed;
var tl2 = Math.min(70, cspeed * 18);
var tg = ctx.createLinearGradient(b.x, b.y, b.x + ctx_tx * tl2, b.y + ctx_ty * tl2);
tg.addColorStop(0, hexToRgba(b.glow, 0.65)); tg.addColorStop(1, hexToRgba(b.glow, 0));
ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + ctx_tx * tl2, b.y + ctx_ty * tl2);
ctx.strokeStyle = tg; ctx.lineWidth = b.radius * 0.8; ctx.lineCap = 'round'; ctx.stroke();
}
}

// Selection highlight ring
if (b === selectedBody) {
ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 5 / camera.zoom, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(200,255,0,0.8)'; ctx.lineWidth = 1.5 / camera.zoom;
ctx.setLineDash([4 / camera.zoom, 3 / camera.zoom]); ctx.stroke(); ctx.setLineDash([]);
}
}

// Rings front half
for (i = 0; i < bodies.length; i++) {
b = bodies[i];
if (b.hasRings) {
ctx.save(); ctx.globalAlpha = 0.7;
ctx.beginPath(); ctx.rect(b.x - b.radius * 4, b.y - b.radius * 4, b.radius * 8, b.radius * 4); ctx.clip();
drawRings(b); ctx.restore();
}
}

drawGravityWells();

// Drag arrow
if (isDragging && spawnMode === 'launch' && !isPanning) {
var ws = screenToWorld(dragStart.sx, dragStart.sy);
var we = screenToWorld(mouseScreen.x, mouseScreen.y);
var adx = we.x - ws.x, ady = we.y - ws.y, alen = Math.sqrt(adx * adx + ady * ady);
if (alen > 3) {
ctx.beginPath(); ctx.moveTo(ws.x, ws.y); ctx.lineTo(we.x, we.y);
ctx.strokeStyle = 'rgba(200,255,0,0.6)'; ctx.lineWidth = 1.5 / camera.zoom;
ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]); ctx.stroke(); ctx.setLineDash([]);
var ang = Math.atan2(ady, adx), hw = 10 / camera.zoom;
ctx.beginPath(); ctx.moveTo(we.x, we.y);
ctx.lineTo(we.x - hw * Math.cos(ang - 0.4), we.y - hw * Math.sin(ang - 0.4));
ctx.lineTo(we.x - hw * Math.cos(ang + 0.4), we.y - hw * Math.sin(ang + 0.4));
ctx.closePath(); ctx.fillStyle = 'rgba(200,255,0,0.7)'; ctx.fill();
ctx.beginPath(); ctx.arc(ws.x, ws.y, 8 / camera.zoom, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(200,255,0,0.4)'; ctx.lineWidth = 1 / camera.zoom; ctx.stroke();
}
}

// Orbit preview
if (spawnMode === 'orbit') {
var wm = screenToWorld(mouseScreen.x, mouseScreen.y);
var near2 = null, nDist2 = Infinity;
for (i = 0; i < bodies.length; i++) {
var odx = bodies[i].x - wm.x, ody = bodies[i].y - wm.y, od = Math.sqrt(odx * odx + ody * ody);
if (od < nDist2 && bodies[i].mass > 20) { near2 = bodies[i]; nDist2 = od; }
}
if (near2 && nDist2 < 600) {
ctx.beginPath(); ctx.arc(near2.x, near2.y, nDist2, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(0,200,255,0.12)'; ctx.lineWidth = 1 / camera.zoom;
ctx.setLineDash([3 / camera.zoom, 5 / camera.zoom]); ctx.stroke(); ctx.setLineDash([]);
ctx.beginPath(); ctx.arc(near2.x, near2.y, near2.radius * 2.5, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(0,200,255,0.3)'; ctx.lineWidth = 1.5 / camera.zoom; ctx.stroke();
}
}

ctx.restore();
}

// ── Input ─────────────────────────────────────────────────────────
var isDragging = false;
var isWellDragging = false;
var dragStart = { sx: 0, sy: 0 };
var mouseScreen = { x: 0, y: 0 };

canvas.addEventListener('mousedown', function(e) {
if (e.button !== 0) return;
if (spawnMode === 'gravity') {
var world = screenToWorld(e.clientX, e.clientY);
gravityWells.push(new GravityWell(world.x, world.y, wellStrength));
isWellDragging = true;
return;
}
var hit = bodyAtScreen(e.clientX, e.clientY);
if (hit) { selectBody(hit); return; }
if (selectedBody) { deselectBody(); return; }
if (spawnMode === 'orbit') {
spawnInOrbit(e.clientX, e.clientY, spawnType);
} else {
dragStart = { sx: e.clientX, sy: e.clientY };
isDragging = true;
}
});

canvas.addEventListener('mousemove', function(e) {
mouseScreen = { x: e.clientX, y: e.clientY };
if (isPanning) {
camera.x = panCamStart.x + (e.clientX - panStart.x);
camera.y = panCamStart.y + (e.clientY - panStart.y);
}
if (isWellDragging && gravityWells.length > 0) {
var world = screenToWorld(e.clientX, e.clientY);
gravityWells[gravityWells.length - 1].x = world.x;
gravityWells[gravityWells.length - 1].y = world.y;
}
});

canvas.addEventListener('mouseup', function(e) {
if (e.button === 1 || e.button === 2) {
isPanning = false; canvas.style.cursor = 'crosshair'; return;
}
if (isWellDragging) {
isWellDragging = false;
if (gravityWells.length > 0) gravityWells.pop();
return;
}
if (!isDragging) return;
isDragging = false;
var world = screenToWorld(dragStart.sx, dragStart.sy);
var dx = e.clientX - dragStart.sx, dy = e.clientY - dragStart.sy;
var velScale = 0.06 / camera.zoom;
var nb = new Body(world.x, world.y, dx * velScale, dy * velScale, spawnType);
if (nb.type === 'planet' && shouldHaveRings(nb)) { nb.hasRings = true; nb.ringTilt = Math.random() * 0.5 + 0.1; nb.ringColor = nb.color; }
if (nb.type === 'star') logEvent('⭐ STAR SPAWNED — CLASS ' + nb.starClass, 'starclass', { cls: nb.starClass });
bodies.push(nb);
});

var touchDragStart = null;
canvas.addEventListener('touchstart', function(e) {
e.preventDefault();
var t = e.touches[0];
touchDragStart = { sx: t.clientX, sy: t.clientY };
mouseScreen = { x: t.clientX, y: t.clientY };
if (spawnMode === 'gravity') {
var world = screenToWorld(t.clientX, t.clientY);
gravityWells.push(new GravityWell(world.x, world.y, wellStrength));
isWellDragging = true;
} else if (spawnMode !== 'orbit') isDragging = true;
}, { passive: false });

canvas.addEventListener('touchmove', function(e) {
e.preventDefault();
var t = e.touches[0];
mouseScreen = { x: t.clientX, y: t.clientY };
if (isWellDragging && gravityWells.length > 0) {
var world = screenToWorld(t.clientX, t.clientY);
gravityWells[gravityWells.length - 1].x = world.x;
gravityWells[gravityWells.length - 1].y = world.y;
}
}, { passive: false });

canvas.addEventListener('touchend', function(e) {
e.preventDefault();
isDragging = false;
if (isWellDragging) { isWellDragging = false; if (gravityWells.length > 0) gravityWells.pop(); return; }
var t = e.changedTouches[0];
if (spawnMode === 'orbit') spawnInOrbit(t.clientX, t.clientY, spawnType);
else if (touchDragStart) {
var world = screenToWorld(touchDragStart.sx, touchDragStart.sy);
var dx = t.clientX - touchDragStart.sx, dy = t.clientY - touchDragStart.sy;
bodies.push(new Body(world.x, world.y, dx * 0.06 / camera.zoom, dy * 0.06 / camera.zoom, spawnType));
}
touchDragStart = null;
}, { passive: false });

// ── UI ────────────────────────────────────────────────────────────
function setType(type, el) {
spawnType = type;
var btns = document.querySelectorAll('.type-btn');
for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
el.classList.add('active');
}

function setSpawnMode(mode) {
spawnMode = mode;
document.getElementById('mode-launch-btn').classList.toggle('active', mode === 'launch');
document.getElementById('mode-orbit-btn').classList.remove('active');
document.getElementById('mode-orbit-btn').classList.toggle('orbit-active', mode === 'orbit');
document.getElementById('mode-gravity-btn').classList.remove('active');
document.getElementById('mode-gravity-btn').classList.toggle('active', mode === 'gravity');
document.getElementById('orbit-hint').classList.toggle('visible', mode === 'orbit');
document.getElementById('gravity-hint').classList.toggle('visible', mode === 'gravity');
document.getElementById('hint').style.opacity = (mode === 'orbit' || mode === 'gravity') ? '0' : '';
if (mode !== 'gravity') gravityWells = [];
}

function updateSlider(name, val) {
var v = parseFloat(val);
if (name === 'gravity') { G = v / 10; document.getElementById('v-gravity').textContent = G.toFixed(1); }
else if (name === 'damping') { damping = v / 1000; document.getElementById('v-damping').textContent = damping.toFixed(3); }
else if (name === 'trail') { trailLen = parseInt(val); document.getElementById('v-trail').textContent = trailLen; }
else if (name === 'zoom') { camera.zoom = v / 100; document.getElementById('v-zoom').textContent = Math.round(v) + '%'; document.getElementById('s-zoom').textContent = Math.round(v); }
else if (name === 'spawnRadius') { customRadius = parseInt(val); document.getElementById('v-spawnRadius').textContent = customRadius; }
else if (name === 'spawnMass') { customMass = parseInt(val); document.getElementById('v-spawnMass').textContent = customMass === 0 ? 'auto' : customMass; }
else if (name === 'timewarp') { timeWarp = v; document.getElementById('v-timewarp').textContent = v.toFixed(1) + 'x'; }
else if (name === 'wellstrength') { wellStrength = v; document.getElementById('v-wellstrength').textContent = Math.round(v); }


}

function togglePause() {
paused = !paused;
var btn = document.getElementById('pause-btn');
btn.textContent = paused ? '▶ RESUME' : '⏸ PAUSE';
btn.classList.toggle('active', paused);
}

function clearAll() {
bodies = []; particles = []; shockwaves = []; nebulae = []; gravityWells = [];
deselectBody();
ctx.clearRect(0, 0, canvas.width, canvas.height);
}

var panelCollapsed = false;
function togglePanel() {
panelCollapsed = !panelCollapsed;
document.getElementById('panel').classList.toggle('collapsed', panelCollapsed);
document.getElementById('panel-toggle-icon').textContent = panelCollapsed ? '▶' : '◀';
}

// ── Presets ───────────────────────────────────────────────────────

function spawnChaos() {
var types = ['planet', 'star', 'comet', 'planet', 'planet', 'comet', 'asteroid'];
var ww = canvas.width / camera.zoom, wh = canvas.height / camera.zoom;
for (var i = 0; i < 30; i++) {
bodies.push(new Body((Math.random() - 0.5) * ww, (Math.random() - 0.5) * wh, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, types[Math.floor(Math.random() * types.length)]));
}
logEvent('💥 CHAOS MODE ACTIVATED', null, null);
}

function spawnOrbit() {
clearAll();
var star = new Body(0, 0, 0, 0, 'star');
// FIX: reduce star mass so orbital speeds are balanced and planets don't spiral in
star.starClass = 'G'; star.mass = 500; star.radius = 22; star.vx = 0; star.vy = 0;
star.color = starClassColors['G']; star.glow = starClassGlows['G'];
bodies.push(star);
// FIX: push orbits further out so planets have room to breathe
var orbits = [120, 200, 300, 420, 550];
var cols = ['#6eb5ff', '#ffaa44', '#44ff88', '#ff4488', '#bb88ff'];
var hasRingsArr = [false, false, true, false, true];
for (var i = 0; i < orbits.length; i++) {
var r = orbits[i], angle = Math.random() * Math.PI * 2;
var speed = Math.sqrt(G * star.mass / r) * 0.97;
var planet = new Body(Math.cos(angle) * r, Math.sin(angle) * r, -Math.sin(angle) * speed, Math.cos(angle) * speed, 'planet');
planet.color = cols[i]; planet.radius = 5 + i * 1.8; planet.mass = 4 + i * 3;
if (hasRingsArr[i]) { planet.hasRings = true; planet.ringTilt = 0.25 + Math.random() * 0.2; planet.ringColor = cols[i]; }
bodies.push(planet);
}
spawnAsteroidBeltAt(260, 25, star);
resetView();
logEvent('🌞 SOLAR SYSTEM SPAWNED', null, null);
}

function spawnAsteroidBeltAt(radius, count, centralBody) {
for (var i = 0; i < count; i++) {
var angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
var r = radius + (Math.random() - 0.5) * 30;
var speed = Math.sqrt(G * centralBody.mass / r) * (0.95 + Math.random() * 0.1);
var asteroid = new Body(centralBody.x + Math.cos(angle) * r, centralBody.y + Math.sin(angle) * r, -Math.sin(angle) * speed + centralBody.vx, Math.cos(angle) * speed + centralBody.vy, 'asteroid');
bodies.push(asteroid);
}
}

function spawnAsteroidBelt() {
var central = null;
for (var i = 0; i < bodies.length; i++) { if (bodies[i].type === 'star' || bodies[i].type === 'blackhole') { central = bodies[i]; break; } }
if (!central) { logEvent('⚠ ADD A STAR FIRST', null, null); return; }
spawnAsteroidBeltAt(200 + Math.random() * 100, 40, central);
logEvent('🪨 ASTEROID BELT SPAWNED', null, null);
}

function spawnBinaryStars() {
clearAll();
var d = 130, starMass = 300;
var mutualSpeed = Math.sqrt(G * starMass / (2 * d)) * 0.95;
var s1 = new Body(-d, 0, 0, -mutualSpeed, 'star');
s1.starClass = 'B'; s1.mass = starMass; s1.radius = 18; s1.isHeavy = false;
s1.color = starClassColors['B']; s1.glow = starClassGlows['B'];
var s2 = new Body(d, 0, 0, mutualSpeed, 'star');
s2.starClass = 'M'; s2.mass = starMass; s2.radius = 18; s2.isHeavy = false;
s2.color = starClassColors['M']; s2.glow = starClassGlows['M'];
bodies.push(s1, s2);
for (var i = 0; i < 3; i++) {
var r = 300 + i * 80, angle = Math.random() * Math.PI * 2;
var speed = Math.sqrt(G * (s1.mass + s2.mass) / r) * 0.95;
var planet = new Body(Math.cos(angle) * r, Math.sin(angle) * r, -Math.sin(angle) * speed, Math.cos(angle) * speed, 'planet');
planet.mass = 6; planet.radius = 6;
if (i === 1) { planet.hasRings = true; planet.ringTilt = 0.3; planet.ringColor = planet.color; }
bodies.push(planet);
}
resetView();
logEvent('⭐ BINARY STAR SYSTEM SPAWNED', null, null);
}

function spawnBlackHoleSystem() {
clearAll();
var bh = new Body(0, 0, 0, 0, 'blackhole');
bh.mass = 1200; bh.radius = 20; bodies.push(bh);
for (var i = 0; i < 5; i++) {
var r = 100 + i * 80, angle = (i / 5) * Math.PI * 2;
var speed = Math.sqrt(G * bh.mass / r) * 0.97;
var planet = new Body(Math.cos(angle) * r, Math.sin(angle) * r, -Math.sin(angle) * speed, Math.cos(angle) * speed, 'planet');
planet.radius = 5 + Math.random() * 5; planet.mass = 5 + Math.random() * 10;
if (i === 2) { planet.hasRings = true; planet.ringTilt = 0.28; planet.ringColor = planet.color; }
bodies.push(planet);
}
for (var j = 0; j < 3; j++) {
var cr = 200 + Math.random() * 200, ca = Math.random() * Math.PI * 2;
var cs = Math.sqrt(G * bh.mass / cr) * (0.6 + Math.random() * 0.6);
bodies.push(new Body(Math.cos(ca) * cr, Math.sin(ca) * cr, -Math.sin(ca) * cs * 0.8, Math.cos(ca) * cs * 1.2, 'comet'));
}
resetView();
logEvent('🕳️ BLACK HOLE SYSTEM SPAWNED', null, null);
}

// ── NEW: Figure-Eight (3-body choreography) ───────────────────────
function spawnFigureEight() {
clearAll();
// Classic figure-8 solution — fixed initial conditions scaled to our G=1
var m = 120;
var scale = 180;
var vscale = 1.8;
// Positions at t=0 (normalized)
var pos = [
{ x: -0.97000436, y: 0.24308753 },
{ x: 0.97000436, y: -0.24308753 },
{ x: 0, y: 0 }
 ];
// Velocities at t=0 (normalized)
var vel = [
{ vx: 0.93240737 / 2, vy: 0.86473146 / 2 },
{ vx: 0.93240737 / 2, vy: 0.86473146 / 2 },
{ vx: -0.93240737, vy: -0.86473146 }
 ];
var colors = ['#ff6644', '#44aaff', '#88ff44'];
for (var i = 0; i < 3; i++) {
var b = new Body(pos[i].x * scale, pos[i].y * scale, vel[i].vx * vscale, vel[i].vy * vscale, 'star');
b.mass = m; b.radius = 14; b.isHeavy = false;
b.starClass = (i === 0 ? 'M' : (i === 1 ? 'B' : 'G'));
b.color = colors[i];
b.glow = colors[i];
bodies.push(b);
}
resetView();
logEvent('∞ FIGURE-8 ORBIT SPAWNED', null, null);
}

// ── NEW: Rogue Flyby ──────────────────────────────────────────────
function spawnRogueFlyby() {
// If no system exists, create a solar system first, then add the rogue
if (bodies.length === 0) spawnOrbit();
// Find the rough center of mass
var cx = 0, cy = 0, tm = 0;
for (var i = 0; i < bodies.length; i++) { cx += bodies[i].x * bodies[i].mass; cy += bodies[i].y * bodies[i].mass; tm += bodies[i].mass; }
if (tm > 0) { cx /= tm; cy /= tm; }
// Spawn a fast rogue star coming in from off-screen left
var rogue = new Body(cx - 800, cy + (Math.random() - 0.5) * 200, 3.5 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8, 'star');
rogue.starClass = 'O';
rogue.mass = 180;
rogue.radius = 16;
rogue.isHeavy = false;
rogue.color = starClassColors['O'];
rogue.glow = starClassGlows['O'];
bodies.push(rogue);
logEvent('☄️ ROGUE STAR FLYBY', null, null);
}

// ── NEW: Galaxy Collision ─────────────────────────────────────────
function spawnGalaxyCollision() {
clearAll();
var galaxies = [
{ cx: -320, cy: -80, vx: 1.1, vy: 0.3, starCount: 2, planetCount: 8, starMass: 350 },
{ cx: 320, cy: 80, vx: -1.1, vy: -0.3, starCount: 2, planetCount: 8, starMass: 350 }
 ];
var starCls = [['G', 'K'], ['B', 'M']];
for (var g = 0; g < 2; g++) {
var gx = galaxies[g];
// Central stars
for (var s = 0; s < gx.starCount; s++) {
var offset = (s - 0.5) * 40;
var st = new Body(gx.cx + offset, gx.cy + offset * 0.3, gx.vx, gx.vy, 'star');
st.starClass = starCls[g][s % 2];
st.mass = gx.starMass; st.radius = 18; st.isHeavy = false;
st.color = starClassColors[st.starClass]; st.glow = starClassGlows[st.starClass];
bodies.push(st);
}
// Orbiting planets (spread around the galaxy center)
for (var p = 0; p < gx.planetCount; p++) {
var orbitR = 80 + p * 35;
var ang = (p / gx.planetCount) * Math.PI * 2 + Math.random() * 0.4;
var spd = Math.sqrt(G * gx.starMass * gx.starCount / orbitR) * 0.9;
var planet = new Body(
gx.cx + Math.cos(ang) * orbitR,
gx.cy + Math.sin(ang) * orbitR,
gx.vx - Math.sin(ang) * spd,
gx.vy + Math.cos(ang) * spd,
'planet'
);
planet.mass = 5 + Math.random() * 8; planet.radius = 4 + Math.random() * 4;
bodies.push(planet);
}
// A few comets
for (var c = 0; c < 3; c++) {
var cr = 300 + Math.random() * 100, ca = Math.random() * Math.PI * 2;
var comet = new Body(gx.cx + Math.cos(ca) * cr, gx.cy + Math.sin(ca) * cr, gx.vx + (Math.random() - 0.5) * 2, gx.vy + (Math.random() - 0.5) * 2, 'comet');
bodies.push(comet);
}
}
resetView();
logEvent('🌌 GALAXY COLLISION INCOMING', null, null);
}

// ── NEW: Pulsar System ────────────────────────────────────────────
function spawnPulsar() {
clearAll();
// Central pulsar (rapidly spinning neutron star)
var pulsar = new Body(0, 0, 0, 0, 'pulsar');
pulsar.mass = 200; pulsar.radius = 7;
pulsar.pulsarAngle = 0; pulsar.pulsarPhase = 0;
bodies.push(pulsar);
// A few planets orbiting the pulsar
var orbits = [90, 160, 240, 340];
var cols = ['#aaddff', '#ffcc88', '#88ffcc', '#ff88cc'];
for (var i = 0; i < orbits.length; i++) {
var r = orbits[i], angle = Math.random() * Math.PI * 2;
var speed = Math.sqrt(G * pulsar.mass / r) * 0.97;
var planet = new Body(Math.cos(angle) * r, Math.sin(angle) * r, -Math.sin(angle) * speed, Math.cos(angle) * speed, 'planet');
planet.color = cols[i]; planet.radius = 4 + i * 1.5; planet.mass = 3 + i * 2;
bodies.push(planet);
}
// Debris field close in
for (var j = 0; j < 15; j++) {
var dr = 45 + Math.random() * 25, da = Math.random() * Math.PI * 2;
var dspeed = Math.sqrt(G * pulsar.mass / dr) * (0.9 + Math.random() * 0.2);
var debris = new Body(Math.cos(da) * dr, Math.sin(da) * dr, -Math.sin(da) * dspeed, Math.cos(da) * dspeed, 'asteroid');
debris.mass = 0.8; debris.radius = 2;
bodies.push(debris);
}
resetView();
logEvent('💫 PULSAR SYSTEM SPAWNED', 'pulsar', {});
}

// ── Stats & Loop ──────────────────────────────────────────────────
function updateStats() {
document.getElementById('s-bodies').textContent = bodies.length;
document.getElementById('s-nova').textContent = novaCount;
document.getElementById('s-time').textContent = simTime.toFixed(1);
document.getElementById('s-zoom').textContent = Math.round(camera.zoom * 100);
if (selectedBody && !selectedBody.dead) updateInspector();
}

var last = null;
function loop(ts) {
if (!last) last = ts;
var dt = Math.min((ts - last) / 16.67, 3);
last = ts; frameCount++;
step(dt); draw();
if (frameCount % 10 === 0) updateStats();
requestAnimationFrame(loop);
}

function startSim() {
    document.getElementById("intro").style.display = "none";
    spawnOrbit();

    

    requestAnimationFrame(loop);
}

// ── Encyclopedia ──────────────────────────────────────────────────
var encyclopediaEntries = [
{ id: 'supernova', icon: '💥', title: 'Supernova', sub: 'Stellar explosion', color: '#ff6633',
fact: 'A supernova can briefly outshine an entire galaxy of 200 billion stars.',
desc: 'A supernova occurs when a massive star exhausts its nuclear fuel and its core collapses. The resulting shockwave blasts the outer layers into space at up to 30,000 km/s. Type II supernovae (core-collapse) leave behind a neutron star or black hole remnant. They seed the universe with heavy elements like iron, gold, and uranium.',
simulate: 'spawnBinaryStars', link: 'https://en.wikipedia.org/wiki/Supernova' },
{ id: 'blackhole', icon: '🕳️', title: 'Black Hole', sub: 'Spacetime singularity', color: '#9900ff',
fact: 'The supermassive black hole at the center of M87 has a mass of 6.5 billion suns.',
desc: 'A black hole is a region of spacetime where gravity is so strong that nothing — not even light — can escape past the event horizon. They form when massive stars collapse at the end of their life cycle. Supermassive black holes lurk at the centers of most large galaxies, including our own Milky Way (Sagittarius A*).',
simulate: 'spawnBlackHoleSystem', link: 'https://en.wikipedia.org/wiki/Black_hole' },
{ id: 'binary', icon: '⭐', title: 'Binary Stars', sub: 'Gravitational dance', color: '#ffcc00',
fact: 'More than half of all stars in the Milky Way are part of binary or multi-star systems.',
desc: 'Binary star systems consist of two stars gravitationally bound and orbiting their common center of mass. They range from contact binaries (stars touching) to wide binaries separated by light-years. Binary systems are crucial for measuring stellar masses and can produce spectacular phenomena like X-ray binaries and Type Ia supernovae.',
simulate: 'spawnBinaryStars', link: 'https://en.wikipedia.org/wiki/Binary_star' },
{ id: 'figureeight', icon: '∞', title: 'Figure-8 Orbit', sub: '3-body choreography', color: '#00ffcc',
fact: 'Discovered in 1993, the figure-8 is one of only a handful of stable 3-body solutions.',
desc: 'The figure-8 orbit is a remarkable solution to the three-body problem where three equal masses chase each other along a figure-8 shaped path. It was discovered numerically by Cris Moore in 1993 and proved to exist rigorously in 2000. Unlike most 3-body configurations, this orbit is periodic and stable — a rare mathematical jewel.',
simulate: 'spawnFigureEight', link: 'https://en.wikipedia.org/wiki/Three-body_problem' },
{ id: 'galaxy', icon: '🌌', title: 'Galaxy Collision', sub: 'Cosmic merger event', color: '#4466ff',
fact: 'The Milky Way and Andromeda galaxies are on a collision course — expected in ~4.5 billion years.',
desc: 'When two galaxies collide, their stars rarely actually hit each other due to the vast distances between them. Instead, gravitational forces reshape both galaxies dramatically, triggering waves of star formation and sending stars on wild new orbits. Over billions of years, the two galaxies merge into a single elliptical galaxy.',
simulate: 'spawnGalaxyCollision', link: 'https://en.wikipedia.org/wiki/Galaxy_merger' },
{ id: 'pulsar', icon: '💫', title: 'Pulsar', sub: 'Cosmic lighthouse', color: '#00ccff',
fact: 'The fastest pulsar spins 716 times per second — faster than a kitchen blender.',
desc: 'Pulsars are highly magnetized rotating neutron stars that emit beams of electromagnetic radiation. As the pulsar rotates, the beam sweeps across space like a lighthouse. They are among the most precise timekeepers in the universe, rivaling atomic clocks. Millisecond pulsars are thought to have been spun up by accreting mass from a companion star.',
simulate: 'spawnPulsar', link: 'https://en.wikipedia.org/wiki/Pulsar' },
{ id: 'rogue', icon: '☄️', title: 'Rogue Flyby', sub: 'Intergalactic intruder', color: '#ff9944',
fact: 'The first confirmed interstellar visitor to our solar system was Oumuamua in 2017.',
desc: 'Rogue stars and objects travel through space without being gravitationally bound to any star system. When they pass through a solar system, their gravity can disrupt planetary orbits, fling planets into new paths, or even eject them entirely. Simulations suggest the early solar system may have had close stellar encounters that shaped the outer planets.',
simulate: 'spawnRogueFlyby', link: 'https://en.wikipedia.org/wiki/Rogue_planet' },
{ id: 'tidal', icon: '🌀', title: 'Tidal Disruption', sub: 'Roche limit event', color: '#ff4488',
fact: 'Saturn rings are thought to be the remains of a moon torn apart by tidal forces.',
desc: 'When an object passes too close to a massive body, tidal forces (the difference in gravity across the object diameter) can exceed the object own self-gravity. The object is then torn apart — this is the Roche limit. For black holes, the tidal disruption of a star creates a brilliant flare visible across billions of light-years.',
simulate: 'spawnBlackHoleSystem', link: 'https://en.wikipedia.org/wiki/Tidal_disruption_event' }
];

var selectedEncEntry = null;

function openEncyclopedia() {
var enc = document.getElementById('encyclopedia');
enc.classList.remove('hidden');
setTimeout(function() { enc.classList.add('open'); }, 10);
buildEncList();
}

function closeEncyclopedia() {
var enc = document.getElementById('encyclopedia');
enc.classList.remove('open');
setTimeout(function() { enc.classList.add('hidden'); }, 350);
}

function buildEncList() {
var list = document.getElementById('enc-list');
list.innerHTML = '';
for (var i = 0; i < encyclopediaEntries.length; i++) {
(function(entry) {
var item = document.createElement('div');
item.className = 'enc-item';
item.style.borderLeftColor = entry.color;
item.innerHTML =
'<div class="enc-item-icon">' + entry.icon + '</div>' +
'<div class="enc-item-text">' +
'<div class="enc-item-title">' + entry.title + '</div>' +
'<div class="enc-item-sub">' + entry.sub + '</div>' +
'</div>' +
'<div class="enc-item-play">▶</div>';
item.addEventListener('click', function() {
document.querySelectorAll('.enc-item').forEach(function(el) { el.classList.remove('active'); });
item.classList.add('active');
showEncDetail(entry);
});
list.appendChild(item);
})(encyclopediaEntries[i]);
}
}

function showEncDetail(entry) {
selectedEncEntry = entry;
var detail = document.getElementById('enc-detail');
detail.classList.remove('hidden');
document.getElementById('enc-detail-icon').textContent = entry.icon;
document.getElementById('enc-detail-title').textContent = entry.title;
document.getElementById('enc-detail-subtitle').textContent = entry.sub;
document.getElementById('enc-detail-fact').textContent = '⚡ ' + entry.fact;
document.getElementById('enc-detail-desc').textContent = entry.desc;
var simBtn = document.getElementById('enc-simulate-btn');
var linkBtn = document.getElementById('enc-link-btn');
simBtn.onclick = function() {
    closeEncyclopedia();
    if (entry.simulate && window[entry.simulate]) {
        window[entry.simulate]();
    }
};
}




























