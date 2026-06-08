// Google Analytics default capture for this template.
// Future LLM edits: do not remove this gtag setup unless replacing it with equivalent page analytics capture.
const googleAnalyticsId = "G-ZKTPLMMFDQ";
const bestScoreStorageKey = "x-game-best-score";

export type GameStatus = "ready" | "running" | "gameover";

export interface Obstacle {
  id: number;
  x: number;
  width: number;
  height: number;
  scored: boolean;
}

export interface RunnerConfig {
  gravity: number;
  groundY: number;
  jumpVelocity: number;
  maxDeltaMs: number;
  minObstacleGap: number;
  obstacleHeight: number;
  obstacleWidth: number;
  scoreRate: number;
  spawnX: number;
  worldWidth: number;
}

export interface RunnerState {
  bestScore: number;
  chickenY: number;
  distance: number;
  nextObstacleId: number;
  obstacles: Obstacle[];
  score: number;
  speed: number;
  status: GameStatus;
  velocityY: number;
}

interface GameElements {
  bestScore: HTMLElement;
  canvas: HTMLCanvasElement;
  jumpButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  score: HTMLElement;
  speed: HTMLElement;
  startButton: HTMLButtonElement;
  status: HTMLElement;
}

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const defaultConfig: RunnerConfig = {
  gravity: 2600,
  groundY: 280,
  jumpVelocity: -920,
  maxDeltaMs: 34,
  minObstacleGap: 430,
  obstacleHeight: 58,
  obstacleWidth: 46,
  scoreRate: 0.045,
  spawnX: 980,
  worldWidth: 960,
};

export function createDefaultGameState(bestScore = 0): RunnerState {
  return {
    bestScore,
    chickenY: 0,
    distance: 0,
    nextObstacleId: 1,
    obstacles: [],
    score: 0,
    speed: 355,
    status: "ready",
    velocityY: 0,
  };
}

export function parseBestScore(storedScore: string | null): number {
  if (!storedScore) return 0;
  const parsed = Number.parseInt(storedScore, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function startGame(state: RunnerState): RunnerState {
  return {
    ...createDefaultGameState(state.bestScore),
    status: "running",
  };
}

export function jump(state: RunnerState, config: RunnerConfig = defaultConfig): RunnerState {
  if (state.status === "ready") return jump(startGame(state), config);
  if (state.status !== "running" || state.chickenY !== 0) return state;
  return { ...state, velocityY: config.jumpVelocity };
}

function shouldSpawnObstacle(state: RunnerState, config: RunnerConfig): boolean {
  const lastObstacle = state.obstacles.at(-1);
  return !lastObstacle || lastObstacle.x < config.worldWidth - config.minObstacleGap;
}

function spawnObstacle(state: RunnerState, config: RunnerConfig): RunnerState {
  if (!shouldSpawnObstacle(state, config)) return state;

  const wave = (state.nextObstacleId % 3) * 9;
  const obstacle: Obstacle = {
    id: state.nextObstacleId,
    x: config.spawnX,
    width: config.obstacleWidth,
    height: config.obstacleHeight + wave,
    scored: false,
  };

  return {
    ...state,
    nextObstacleId: state.nextObstacleId + 1,
    obstacles: [...state.obstacles, obstacle],
  };
}

export function hasCollision(state: RunnerState, config: RunnerConfig = defaultConfig): boolean {
  const chicken = {
    x: 160,
    y: config.groundY - 54 - state.chickenY,
    width: 50,
    height: 50,
  };

  return state.obstacles.some((obstacle) => {
    const obstacleBox = {
      x: obstacle.x,
      y: config.groundY - obstacle.height,
      width: obstacle.width,
      height: obstacle.height,
    };

    return (
      chicken.x < obstacleBox.x + obstacleBox.width &&
      chicken.x + chicken.width > obstacleBox.x &&
      chicken.y < obstacleBox.y + obstacleBox.height &&
      chicken.y + chicken.height > obstacleBox.y
    );
  });
}

export function stepGame(
  state: RunnerState,
  deltaMs: number,
  config: RunnerConfig = defaultConfig,
): RunnerState {
  if (state.status !== "running") return state;

  const deltaSeconds = Math.min(deltaMs, config.maxDeltaMs) / 1000;
  let nextState = spawnObstacle(state, config);
  const speed = Math.min(650, nextState.speed + deltaSeconds * 7.5);
  const distance = nextState.distance + speed * deltaSeconds;
  const velocityY = nextState.velocityY + config.gravity * deltaSeconds;
  const chickenY = Math.max(0, nextState.chickenY - velocityY * deltaSeconds);
  const landedVelocity = chickenY === 0 && velocityY > 0 ? 0 : velocityY;
  let score = Math.max(nextState.score, Math.floor(distance * config.scoreRate));

  const obstacles = nextState.obstacles
    .map((obstacle) => {
      const x = obstacle.x - speed * deltaSeconds;
      const passed = x + obstacle.width < 160;
      if (passed && !obstacle.scored) score += 10;
      return { ...obstacle, x, scored: obstacle.scored || passed };
    })
    .filter((obstacle) => obstacle.x + obstacle.width > -20);

  nextState = {
    ...nextState,
    chickenY,
    distance,
    obstacles,
    score,
    speed,
    velocityY: landedVelocity,
  };

  if (hasCollision(nextState, config)) {
    const bestScore = Math.max(nextState.bestScore, nextState.score);
    return { ...nextState, bestScore, status: "gameover", velocityY: 0 };
  }

  return nextState;
}

function initializeGoogleAnalytics() {
  const googleTagScript = document.createElement("script");
  googleTagScript.async = true;
  googleTagScript.src = `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`;
  document.head.append(googleTagScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer?.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", googleAnalyticsId);
}

function getElement<T extends Element>(selector: string, type: { new (): T }): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function getElements(): GameElements {
  return {
    bestScore: getElement("#best-score", HTMLElement),
    canvas: getElement("#game-canvas", HTMLCanvasElement),
    jumpButton: getElement("#jump-button", HTMLButtonElement),
    resetButton: getElement("#reset-button", HTMLButtonElement),
    score: getElement("#score", HTMLElement),
    speed: getElement("#speed", HTMLElement),
    startButton: getElement("#start-button", HTMLButtonElement),
    status: getElement("#game-status", HTMLElement),
  };
}

function drawGame(context: CanvasRenderingContext2D, state: RunnerState, width: number, height: number) {
  const scale = width / defaultConfig.worldWidth;
  const groundY = defaultConfig.groundY * scale;
  const chickenX = 160 * scale;
  const chickenY = groundY - (54 + state.chickenY) * scale;

  context.clearRect(0, 0, width, height);

  const skyGradient = context.createLinearGradient(0, 0, 0, height);
  skyGradient.addColorStop(0, "#91d9ff");
  skyGradient.addColorStop(0.62, "#f6f2da");
  skyGradient.addColorStop(1, "#c7e07a");
  context.fillStyle = skyGradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#fff7bf";
  context.beginPath();
  context.arc(width - 92 * scale, 72 * scale, 34 * scale, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#7abd42";
  context.fillRect(0, groundY, width, height - groundY);
  context.fillStyle = "#5c8f35";
  context.fillRect(0, groundY + 12 * scale, width, 8 * scale);

  context.strokeStyle = "rgba(59, 92, 40, 0.42)";
  context.lineWidth = 3 * scale;
  for (let x = -80 * scale + ((state.distance * 0.7) % (80 * scale)); x < width; x += 80 * scale) {
    context.beginPath();
    context.moveTo(x, groundY + 34 * scale);
    context.lineTo(x + 36 * scale, groundY + 18 * scale);
    context.stroke();
  }

  state.obstacles.forEach((obstacle) => {
    const x = obstacle.x * scale;
    const obstacleWidth = obstacle.width * scale;
    const obstacleHeight = obstacle.height * scale;
    const y = groundY - obstacleHeight;

    context.fillStyle = "#6b4a2e";
    context.fillRect(x, y, obstacleWidth, obstacleHeight);
    context.fillStyle = "#8e6a43";
    context.fillRect(x + 8 * scale, y, obstacleWidth - 16 * scale, obstacleHeight);
    context.fillStyle = "#3d2d20";
    context.fillRect(x - 5 * scale, y, obstacleWidth + 10 * scale, 8 * scale);
  });

  context.save();
  context.translate(chickenX, chickenY);
  context.fillStyle = "#ffe36e";
  context.beginPath();
  context.ellipse(24 * scale, 27 * scale, 27 * scale, 22 * scale, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffcf4a";
  context.beginPath();
  context.ellipse(2 * scale, 28 * scale, 16 * scale, 14 * scale, -0.2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f25f33";
  context.beginPath();
  context.moveTo(50 * scale, 24 * scale);
  context.lineTo(68 * scale, 31 * scale);
  context.lineTo(50 * scale, 38 * scale);
  context.closePath();
  context.fill();
  context.fillStyle = "#1d1d1d";
  context.beginPath();
  context.arc(36 * scale, 21 * scale, 3.7 * scale, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#70411f";
  context.lineWidth = 4 * scale;
  context.beginPath();
  context.moveTo(20 * scale, 48 * scale);
  context.lineTo(15 * scale, 61 * scale);
  context.moveTo(35 * scale, 48 * scale);
  context.lineTo(39 * scale, 61 * scale);
  context.stroke();
  context.restore();

  if (state.status !== "running") {
    context.fillStyle = "rgba(14, 28, 33, 0.58)";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.font = `700 ${Math.max(20, 30 * scale)}px system-ui, sans-serif`;
    context.fillText(state.status === "ready" ? "Press Start" : "Game Over", width / 2, height / 2 - 8);
    context.font = `600 ${Math.max(14, 17 * scale)}px system-ui, sans-serif`;
    context.fillText("Jump obstacles. Score points. Keep running.", width / 2, height / 2 + 26);
  }
}

function initializeApp() {
  initializeGoogleAnalytics();

  const elements = getElements();
  const maybeContext = elements.canvas.getContext("2d");
  if (!maybeContext) throw new Error("Missing 2D canvas support");
  const context = maybeContext;

  let state = createDefaultGameState(parseBestScore(localStorage.getItem(bestScoreStorageKey)));
  let lastFrameTime = 0;

  function saveBestScore() {
    localStorage.setItem(bestScoreStorageKey, String(state.bestScore));
  }

  function resizeCanvas() {
    const rect = elements.canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    elements.canvas.width = Math.round(rect.width * pixelRatio);
    elements.canvas.height = Math.round(rect.height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawGame(context, state, rect.width, rect.height);
  }

  function renderHud() {
    elements.score.textContent = String(state.score);
    elements.bestScore.textContent = String(state.bestScore);
    elements.speed.textContent = `${Math.round(state.speed)}`;
    elements.status.textContent =
      state.status === "running" ? "Running" : state.status === "gameover" ? "Crashed" : "Ready";
    elements.startButton.textContent = state.status === "gameover" ? "Restart" : "Start";
  }

  function performJump() {
    state = jump(state);
    renderHud();
  }

  function restart() {
    state = startGame(state);
    renderHud();
  }

  function loop(frameTime: number) {
    const rect = elements.canvas.getBoundingClientRect();
    const deltaMs = lastFrameTime === 0 ? 16 : frameTime - lastFrameTime;
    lastFrameTime = frameTime;

    const previousStatus = state.status;
    state = stepGame(state, deltaMs);
    if (previousStatus !== "gameover" && state.status === "gameover") saveBestScore();

    renderHud();
    drawGame(context, state, rect.width, rect.height);
    window.requestAnimationFrame(loop);
  }

  elements.startButton.addEventListener("click", restart);
  elements.resetButton.addEventListener("click", () => {
    state = createDefaultGameState(state.bestScore);
    renderHud();
  });
  elements.jumpButton.addEventListener("click", performJump);
  elements.canvas.addEventListener("pointerdown", performJump);
  window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "ArrowUp" && event.code !== "KeyW") return;
    event.preventDefault();
    performJump();
  });
  window.addEventListener("resize", resizeCanvas);

  document.title = "X game";
  renderHud();
  resizeCanvas();
  window.requestAnimationFrame(loop);
}

if (typeof document !== "undefined") {
  initializeApp();
}
