"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface Bullet {
  id: number
  x: number
  y: number
}

interface Alien {
  id: number
  x: number
  y: number
  type: number
  health: number
}

interface Explosion {
  id: number
  x: number
  y: number
  frame: number
}

interface Star {
  x: number
  y: number
  size: number
  speed: number
}

const GAME_WIDTH = 800
const GAME_HEIGHT = 600
const CAR_WIDTH = 60
const CAR_HEIGHT = 80
const BULLET_WIDTH = 6
const BULLET_HEIGHT = 20
const ALIEN_WIDTH = 50
const ALIEN_HEIGHT = 50

export default function SpaceCarGame() {
  const [gameState, setGameState] = useState<"start" | "playing" | "gameover">("start")
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [carX, setCarX] = useState(GAME_WIDTH / 2 - CAR_WIDTH / 2)
  const [bullets, setBullets] = useState<Bullet[]>([])
  const [aliens, setAliens] = useState<Alien[]>([])
  const [explosions, setExplosions] = useState<Explosion[]>([])
  const [stars, setStars] = useState<Star[]>([])
  
  const keysRef = useRef<Set<string>>(new Set())
  const bulletIdRef = useRef(0)
  const alienIdRef = useRef(0)
  const explosionIdRef = useRef(0)
  const lastShotRef = useRef(0)
  const gameLoopRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize stars
  useEffect(() => {
    const initialStars: Star[] = Array.from({ length: 100 }, () => ({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 2 + 0.5,
    }))
    setStars(initialStars)
  }, [])

  const spawnAlien = useCallback((currentLevel: number) => {
    const types = Math.min(currentLevel, 3)
    const type = Math.floor(Math.random() * types) + 1
    const health = type
    const alien: Alien = {
      id: alienIdRef.current++,
      x: Math.random() * (GAME_WIDTH - ALIEN_WIDTH),
      y: -ALIEN_HEIGHT,
      type,
      health,
    }
    return alien
  }, [])

  const createExplosion = useCallback((x: number, y: number) => {
    const explosion: Explosion = {
      id: explosionIdRef.current++,
      x,
      y,
      frame: 0,
    }
    setExplosions((prev) => [...prev, explosion])
  }, [])

  const startGame = useCallback(() => {
    setGameState("playing")
    setScore(0)
    setLevel(1)
    setCarX(GAME_WIDTH / 2 - CAR_WIDTH / 2)
    setBullets([])
    setAliens([])
    setExplosions([])
    keysRef.current.clear()
    containerRef.current?.focus()
  }, [])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key)
      if (e.key === " " && gameState === "playing") {
        e.preventDefault()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [gameState])

  // Game loop
  useEffect(() => {
    if (gameState !== "playing") {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
      return
    }

    let lastTime = performance.now()
    let alienSpawnTimer = 0
    const spawnInterval = Math.max(2000 - level * 150, 500)

    const gameLoop = (currentTime: number) => {
      const deltaTime = currentTime - lastTime
      lastTime = currentTime

      // Move car
      setCarX((prev) => {
        let newX = prev
        const speed = 8
        if (keysRef.current.has("ArrowLeft") || keysRef.current.has("a")) {
          newX -= speed
        }
        if (keysRef.current.has("ArrowRight") || keysRef.current.has("d")) {
          newX += speed
        }
        return Math.max(0, Math.min(GAME_WIDTH - CAR_WIDTH, newX))
      })

      // Shoot
      if (keysRef.current.has(" ") || keysRef.current.has("ArrowUp")) {
        const now = performance.now()
        const fireRate = Math.max(300 - level * 20, 150)
        if (now - lastShotRef.current > fireRate) {
          lastShotRef.current = now
          setCarX((currentCarX) => {
            setBullets((prev) => [
              ...prev,
              {
                id: bulletIdRef.current++,
                x: currentCarX + CAR_WIDTH / 2 - BULLET_WIDTH / 2,
                y: GAME_HEIGHT - CAR_HEIGHT - BULLET_HEIGHT,
              },
            ])
            return currentCarX
          })
        }
      }

      // Move bullets
      setBullets((prev) =>
        prev
          .map((b) => ({ ...b, y: b.y - 12 }))
          .filter((b) => b.y > -BULLET_HEIGHT)
      )

      // Move stars (parallax)
      setStars((prev) =>
        prev.map((star) => ({
          ...star,
          y: star.y + star.speed,
          ...(star.y > GAME_HEIGHT && {
            y: 0,
            x: Math.random() * GAME_WIDTH,
          }),
        }))
      )

      // Spawn aliens
      alienSpawnTimer += deltaTime
      if (alienSpawnTimer > spawnInterval) {
        alienSpawnTimer = 0
        setAliens((prev) => [...prev, spawnAlien(level)])
      }

      // Move aliens
      const alienSpeed = 2 + level * 0.5
      setAliens((prev) =>
        prev.map((a) => ({
          ...a,
          y: a.y + alienSpeed,
        }))
      )

      // Update explosions
      setExplosions((prev) =>
        prev
          .map((e) => ({ ...e, frame: e.frame + 1 }))
          .filter((e) => e.frame < 10)
      )

      // Check collisions
      setBullets((prevBullets) => {
        setAliens((prevAliens) => {
          const newAliens = [...prevAliens]
          const bulletsToRemove = new Set<number>()
          let scoreIncrease = 0

          prevBullets.forEach((bullet) => {
            newAliens.forEach((alien, index) => {
              if (
                bullet.x < alien.x + ALIEN_WIDTH &&
                bullet.x + BULLET_WIDTH > alien.x &&
                bullet.y < alien.y + ALIEN_HEIGHT &&
                bullet.y + BULLET_HEIGHT > alien.y
              ) {
                bulletsToRemove.add(bullet.id)
                newAliens[index] = { ...alien, health: alien.health - 1 }
                if (newAliens[index].health <= 0) {
                  createExplosion(
                    alien.x + ALIEN_WIDTH / 2,
                    alien.y + ALIEN_HEIGHT / 2
                  )
                  scoreIncrease += alien.type * 100
                }
              }
            })
          })

          if (scoreIncrease > 0) {
            setScore((prev) => {
              const newScore = prev + scoreIncrease
              // Level up every 1000 points
              setLevel(Math.floor(newScore / 1000) + 1)
              return newScore
            })
          }

          return newAliens.filter((a) => a.health > 0)
        })

        return prevBullets.filter((b) => {
          let hit = false
          aliens.forEach((alien) => {
            if (
              b.x < alien.x + ALIEN_WIDTH &&
              b.x + BULLET_WIDTH > alien.x &&
              b.y < alien.y + ALIEN_HEIGHT &&
              b.y + BULLET_HEIGHT > alien.y
            ) {
              hit = true
            }
          })
          return !hit
        })
      })

      // Check game over (alien reaches bottom or hits car)
      setAliens((prevAliens) => {
        let gameOver = false
        setCarX((currentCarX) => {
          prevAliens.forEach((alien) => {
            if (alien.y + ALIEN_HEIGHT > GAME_HEIGHT) {
              gameOver = true
            }
            // Check car collision
            if (
              alien.x < currentCarX + CAR_WIDTH &&
              alien.x + ALIEN_WIDTH > currentCarX &&
              alien.y + ALIEN_HEIGHT > GAME_HEIGHT - CAR_HEIGHT &&
              alien.y < GAME_HEIGHT
            ) {
              gameOver = true
            }
          })
          return currentCarX
        })

        if (gameOver) {
          setScore((currentScore) => {
            setHighScore((prev) => Math.max(prev, currentScore))
            return currentScore
          })
          setGameState("gameover")
        }

        return prevAliens.filter((a) => a.y < GAME_HEIGHT + ALIEN_HEIGHT)
      })

      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameState, level, spawnAlien, createExplosion, aliens])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div
        ref={containerRef}
        tabIndex={0}
        className="relative outline-none"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      >
        {/* Game container with border */}
        <div
          className="absolute inset-0 rounded-lg overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #0a0a1a 0%, #0f1629 50%, #0a0a1a 100%)",
            boxShadow: "0 0 40px rgba(0, 200, 255, 0.2), inset 0 0 60px rgba(0, 0, 0, 0.5)",
            border: "2px solid rgba(0, 200, 255, 0.3)",
          }}
        >
          {/* Stars */}
          {stars.map((star, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: star.x,
                top: star.y,
                width: star.size,
                height: star.size,
                opacity: 0.3 + star.speed * 0.2,
              }}
            />
          ))}

          {/* HUD */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
            <div className="flex flex-col gap-1">
              <div
                className="text-2xl font-mono font-bold tracking-wider"
                style={{ color: "#00c8ff", textShadow: "0 0 10px #00c8ff" }}
              >
                SCORE: {score.toString().padStart(6, "0")}
              </div>
              <div
                className="text-sm font-mono"
                style={{ color: "#ff6b35", textShadow: "0 0 8px #ff6b35" }}
              >
                HIGH SCORE: {highScore.toString().padStart(6, "0")}
              </div>
            </div>
            <div
              className="text-xl font-mono font-bold px-4 py-2 rounded"
              style={{
                color: "#00ff88",
                textShadow: "0 0 10px #00ff88",
                background: "rgba(0, 255, 136, 0.1)",
                border: "1px solid rgba(0, 255, 136, 0.3)",
              }}
            >
              LEVEL {level}
            </div>
          </div>

          {/* Car */}
          {gameState === "playing" && (
            <div
              className="absolute transition-transform duration-50"
              style={{
                left: carX,
                bottom: 20,
                width: CAR_WIDTH,
                height: CAR_HEIGHT,
              }}
            >
              {/* Car body */}
              <svg
                viewBox="0 0 60 80"
                className="w-full h-full"
                style={{ filter: "drop-shadow(0 0 8px #00c8ff)" }}
              >
                {/* Main body */}
                <path
                  d="M10 70 L10 35 L15 20 L25 10 L35 10 L45 20 L50 35 L50 70 Z"
                  fill="#1a2a4a"
                  stroke="#00c8ff"
                  strokeWidth="2"
                />
                {/* Cockpit */}
                <path
                  d="M20 35 L20 20 L25 15 L35 15 L40 20 L40 35 Z"
                  fill="#00c8ff"
                  opacity="0.6"
                />
                {/* Engine glow */}
                <ellipse cx="20" cy="75" rx="6" ry="8" fill="#ff6b35" opacity="0.8">
                  <animate attributeName="opacity" values="0.8;0.4;0.8" dur="0.2s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="40" cy="75" rx="6" ry="8" fill="#ff6b35" opacity="0.8">
                  <animate attributeName="opacity" values="0.4;0.8;0.4" dur="0.2s" repeatCount="indefinite" />
                </ellipse>
                {/* Wheels/thrusters */}
                <rect x="5" y="50" width="8" height="20" rx="2" fill="#0a1a3a" stroke="#00c8ff" strokeWidth="1" />
                <rect x="47" y="50" width="8" height="20" rx="2" fill="#0a1a3a" stroke="#00c8ff" strokeWidth="1" />
                {/* Gun mounts */}
                <rect x="12" y="8" width="4" height="12" fill="#ff6b35" />
                <rect x="44" y="8" width="4" height="12" fill="#ff6b35" />
              </svg>
            </div>
          )}

          {/* Bullets */}
          {bullets.map((bullet) => (
            <div
              key={bullet.id}
              className="absolute"
              style={{
                left: bullet.x,
                top: bullet.y,
                width: BULLET_WIDTH,
                height: BULLET_HEIGHT,
              }}
            >
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: "linear-gradient(180deg, #ff6b35 0%, #ffaa00 100%)",
                  boxShadow: "0 0 10px #ff6b35, 0 0 20px #ff6b35",
                }}
              />
            </div>
          ))}

          {/* Aliens */}
          {aliens.map((alien) => (
            <div
              key={alien.id}
              className="absolute"
              style={{
                left: alien.x,
                top: alien.y,
                width: ALIEN_WIDTH,
                height: ALIEN_HEIGHT,
              }}
            >
              <svg viewBox="0 0 50 50" className="w-full h-full">
                {alien.type === 1 && (
                  // Basic alien - green
                  <g style={{ filter: "drop-shadow(0 0 6px #00ff88)" }}>
                    <ellipse cx="25" cy="25" rx="20" ry="15" fill="#0a3a2a" stroke="#00ff88" strokeWidth="2" />
                    <circle cx="18" cy="22" r="5" fill="#00ff88" />
                    <circle cx="32" cy="22" r="5" fill="#00ff88" />
                    <circle cx="18" cy="22" r="2" fill="#0a3a2a" />
                    <circle cx="32" cy="22" r="2" fill="#0a3a2a" />
                    <path d="M15 32 Q25 38 35 32" stroke="#00ff88" strokeWidth="2" fill="none" />
                  </g>
                )}
                {alien.type === 2 && (
                  // Medium alien - orange
                  <g style={{ filter: "drop-shadow(0 0 6px #ff6b35)" }}>
                    <path d="M5 40 L15 10 L25 25 L35 10 L45 40 L25 35 Z" fill="#3a1a0a" stroke="#ff6b35" strokeWidth="2" />
                    <circle cx="18" cy="25" r="4" fill="#ff6b35" />
                    <circle cx="32" cy="25" r="4" fill="#ff6b35" />
                    <path d="M20 35 L25 40 L30 35" stroke="#ff6b35" strokeWidth="2" fill="none" />
                  </g>
                )}
                {alien.type >= 3 && (
                  // Boss alien - red
                  <g style={{ filter: "drop-shadow(0 0 8px #ff2255)" }}>
                    <polygon points="25,5 45,20 40,45 10,45 5,20" fill="#3a0a1a" stroke="#ff2255" strokeWidth="2" />
                    <circle cx="17" cy="25" r="6" fill="#ff2255" />
                    <circle cx="33" cy="25" r="6" fill="#ff2255" />
                    <circle cx="17" cy="25" r="3" fill="#ffffff" />
                    <circle cx="33" cy="25" r="3" fill="#ffffff" />
                    <path d="M15 38 L25 32 L35 38" stroke="#ff2255" strokeWidth="3" fill="none" />
                    {/* Health bar */}
                    <rect x="10" y="2" width="30" height="4" fill="#3a0a1a" stroke="#ff2255" strokeWidth="1" />
                    <rect x="10" y="2" width={30 * (alien.health / 3)} height="4" fill="#ff2255" />
                  </g>
                )}
              </svg>
            </div>
          ))}

          {/* Explosions */}
          {explosions.map((explosion) => (
            <div
              key={explosion.id}
              className="absolute pointer-events-none"
              style={{
                left: explosion.x - 30,
                top: explosion.y - 30,
                width: 60,
                height: 60,
              }}
            >
              <svg viewBox="0 0 60 60" className="w-full h-full">
                <circle
                  cx="30"
                  cy="30"
                  r={5 + explosion.frame * 3}
                  fill="none"
                  stroke="#ff6b35"
                  strokeWidth={3 - explosion.frame * 0.2}
                  opacity={1 - explosion.frame * 0.1}
                  style={{ filter: "drop-shadow(0 0 10px #ff6b35)" }}
                />
                <circle
                  cx="30"
                  cy="30"
                  r={3 + explosion.frame * 2}
                  fill="#ffaa00"
                  opacity={0.8 - explosion.frame * 0.08}
                />
              </svg>
            </div>
          ))}

          {/* Start Screen */}
          {gameState === "start" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
              <h1
                className="text-5xl font-mono font-bold mb-4 tracking-widest animate-float"
                style={{
                  color: "#00c8ff",
                  textShadow: "0 0 20px #00c8ff, 0 0 40px #00c8ff",
                }}
              >
                SPACE CAR
              </h1>
              <h2
                className="text-3xl font-mono mb-8"
                style={{
                  color: "#ff6b35",
                  textShadow: "0 0 15px #ff6b35",
                }}
              >
                DEFENDER
              </h2>
              
              <div className="flex flex-col gap-2 mb-8 text-center">
                <p className="text-foreground/70 font-mono text-sm">
                  Use <span className="text-primary">← →</span> or <span className="text-primary">A D</span> to move
                </p>
                <p className="text-foreground/70 font-mono text-sm">
                  Press <span className="text-primary">SPACE</span> or <span className="text-primary">↑</span> to shoot
                </p>
              </div>

              <button
                onClick={startGame}
                className="px-8 py-4 font-mono text-xl font-bold rounded-lg transition-all duration-200 hover:scale-105"
                style={{
                  background: "linear-gradient(180deg, #00c8ff 0%, #0088aa 100%)",
                  color: "#0a1a2a",
                  boxShadow: "0 0 20px #00c8ff, 0 4px 0 #005577",
                }}
              >
                START GAME
              </button>
            </div>
          )}

          {/* Game Over Screen */}
          {gameState === "gameover" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
              <h1
                className="text-5xl font-mono font-bold mb-4 tracking-widest"
                style={{
                  color: "#ff2255",
                  textShadow: "0 0 20px #ff2255, 0 0 40px #ff2255",
                }}
              >
                GAME OVER
              </h1>
              
              <div className="flex flex-col gap-4 mb-8 text-center">
                <p
                  className="text-3xl font-mono font-bold"
                  style={{ color: "#00c8ff", textShadow: "0 0 10px #00c8ff" }}
                >
                  SCORE: {score.toString().padStart(6, "0")}
                </p>
                <p
                  className="text-xl font-mono"
                  style={{ color: "#ff6b35", textShadow: "0 0 8px #ff6b35" }}
                >
                  LEVEL REACHED: {level}
                </p>
                {score >= highScore && score > 0 && (
                  <p
                    className="text-lg font-mono animate-pulse"
                    style={{ color: "#00ff88", textShadow: "0 0 10px #00ff88" }}
                  >
                    NEW HIGH SCORE!
                  </p>
                )}
              </div>

              <button
                onClick={startGame}
                className="px-8 py-4 font-mono text-xl font-bold rounded-lg transition-all duration-200 hover:scale-105"
                style={{
                  background: "linear-gradient(180deg, #00ff88 0%, #00aa55 100%)",
                  color: "#0a2a1a",
                  boxShadow: "0 0 20px #00ff88, 0 4px 0 #006633",
                }}
              >
                PLAY AGAIN
              </button>
            </div>
          )}
        </div>

        {/* Controls hint during gameplay */}
        {gameState === "playing" && (
          <div className="absolute -bottom-8 left-0 right-0 text-center">
            <p className="text-muted-foreground font-mono text-xs">
              ← → Move | SPACE Shoot
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
