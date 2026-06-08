import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createDefaultGameState,
  defaultConfig,
  hasCollision,
  jump,
  parseBestScore,
  startGame,
  stepGame,
} from "../public/app.js";

test("createDefaultGameState starts X game ready with best score", () => {
  const state = createDefaultGameState(12);

  assert.equal(state.status, "ready");
  assert.equal(state.bestScore, 12);
  assert.equal(state.score, 0);
  assert.deepEqual(state.obstacles, []);
});

test("parseBestScore accepts positive integers only", () => {
  assert.equal(parseBestScore("42"), 42);
  assert.equal(parseBestScore("-4"), 0);
  assert.equal(parseBestScore("nope"), 0);
  assert.equal(parseBestScore(null), 0);
});

test("jump starts game and moves chicken upward", () => {
  const ready = createDefaultGameState();
  const jumping = jump(ready);
  const stepped = stepGame(jumping, 16);

  assert.equal(jumping.status, "running");
  assert.equal(jumping.velocityY, defaultConfig.jumpVelocity);
  assert.ok(stepped.chickenY > 0);
});

test("stepGame spawns obstacles and scores passed obstacles", () => {
  const state = {
    ...startGame(createDefaultGameState()),
    obstacles: [{ id: 1, x: 130, width: 20, height: 30, scored: false }],
    nextObstacleId: 2,
    chickenY: 120,
  };

  const stepped = stepGame(state, 100);

  assert.ok(stepped.score >= 10);
  assert.equal(stepped.obstacles[0]?.scored, true);
});

test("collision ends game and stores best score", () => {
  const state = {
    ...startGame(createDefaultGameState(3)),
    score: 9,
    obstacles: [{ id: 1, x: 170, width: 42, height: 70, scored: false }],
  };

  assert.equal(hasCollision(state), true);
  const crashed = stepGame(state, 16);

  assert.equal(crashed.status, "gameover");
  assert.equal(crashed.bestScore, 9);
});

test("served files do not reference disallowed providers or tooling", async () => {
  const servedFiles = [
    "public/app.js",
    "public/humans.txt",
    "public/index.html",
    "public/llm.txt",
  ];

  for (const file of servedFiles) {
    const content = await readFile(file, "utf8");
    assert.doesNotMatch(content, /\bgit\b|cloudflare/i, file);
  }
});
