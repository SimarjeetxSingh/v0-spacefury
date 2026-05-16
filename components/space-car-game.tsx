"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface Bullet {
  id: number
  x: number
  y: number
  startX: number // Track starting position for wave calculation
  startY: number
}

interface EnemyBullet {
  id: number
  x: number
  y: number
  angle: number
}

interface Alien {
  id: number
  x: number
  y: number
  type: number
  health: number
  maxHealth: number
  lastShot: number
  movePattern: "straight" | "zigzag" | "dive"
  movePhase: number
}

interface Explosion {
  id: number
  x: number
  y: number
  frame: number
  size: number
}

interface HitEffect {
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
const ENEMY_BULLET_SIZE = 10
const ALIEN_WIDTH = 50
const ALIEN_HEIGHT = 50
const BOSS_WIDTH = 80
const BOSS_HEIGHT = 80

// Alien types configuration
const ALIEN_CONFIG = {
  1: { health: 2, points: 100, canShoot: false, shootRate: 0, color: "#00ff88", name: "Scout" },
  2: { health: 4, points: 200, canShoot: true, shootRate: 3000, color: "#ff6b35", name: "Fighter" },
  3: { health: 6, points: 300, canShoot: true, shootRate: 2000, color: "#ff2255", name: "Hunter" },
  // Boss types - much higher health, need many hits to kill
  4: { health: 25, points: 1000, canShoot: true, shootRate: 1500, color: "#aa00ff", name: "Destroyer" },
  5: { health: 40, points: 1500, canShoot: true, shootRate: 1200, color: "#ff00aa", name: "Annihilator" },
  6: { health: 60, points: 2500, canShoot: true, shootRate: 1000, color: "#ffaa00", name: "Overlord" },
}

export default function SpaceCarGame() {
  const [gameState, setGameState] = useState<"start" | "playing" | "gameover">("start")
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [carX, setCarX] = useState(GAME_WIDTH / 2 - CAR_WIDTH / 2)
  const [carHealth, setCarHealth] = useState(3)
  const [bullets, setBullets] = useState<Bullet[]>([])
  const [enemyBullets, setEnemyBullets] = useState<EnemyBullet[]>([])
  const [aliens, setAliens] = useState<Alien[]>([])
  const [explosions, setExplosions] = useState<Explosion[]>([])
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([])
  const [stars, setStars] = useState<Star[]>([])
  const [screenShake, setScreenShake] = useState(0)
  const [isInvincible, setIsInvincible] = useState(false)
  
  const keysRef = useRef<Set<string>>(new Set())
  const bulletIdRef = useRef(0)
  const enemyBulletIdRef = useRef(0)
  const alienIdRef = useRef(0)
  const explosionIdRef = useRef(0)
  const hitEffectIdRef = useRef(0)
  const lastShotRef = useRef(0)
  const gameLoopRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const carXRef = useRef(GAME_WIDTH / 2 - CAR_WIDTH / 2)

  // Keep carXRef in sync
  useEffect(() => {
    carXRef.current = carX
  }, [carX])

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

  const spawnAlien = useCallback((currentLevel: number, forceBoss: boolean = false): Alien => {
    let type: number
    
    if (forceBoss) {
      // Spawn boss based on level
      if (currentLevel >= 8) {
        type = 6 // Overlord
      } else if (currentLevel >= 5) {
        type = 5 // Annihilator
      } else {
        type = 4 // Destroyer
      }
    } else {
      // Regular aliens with increasing difficulty
      const rand = Math.random()
      if (currentLevel >= 3 && rand < 0.1) {
        type = 3 // Hunter
      } else if (currentLevel >= 2 && rand < 0.35) {
        type = 2 // Fighter
      } else {
        type = 1 // Scout
      }
    }
    
    const config = ALIEN_CONFIG[type as keyof typeof ALIEN_CONFIG]
    const isBoss = type >= 4
    const width = isBoss ? BOSS_WIDTH : ALIEN_WIDTH
    
    const movePatterns: ("straight" | "zigzag" | "dive")[] = ["straight", "zigzag", "dive"]
    const pattern = isBoss ? "zigzag" : movePatterns[Math.floor(Math.random() * movePatterns.length)]
    
    return {
      id: alienIdRef.current++,
      x: Math.random() * (GAME_WIDTH - width),
      y: -ALIEN_HEIGHT - (isBoss ? 30 : 0),
      type,
      health: config.health,
      maxHealth: config.health,
      lastShot: 0,
      movePattern: pattern,
      movePhase: Math.random() * Math.PI * 2,
    }
  }, [])

  const createExplosion = useCallback((x: number, y: number, size: number = 60) => {
    const explosion: Explosion = {
      id: explosionIdRef.current++,
      x,
      y,
      frame: 0,
      size,
    }
    setExplosions((prev) => [...prev, explosion])
    // Screen shake for explosions
    setScreenShake(size > 80 ? 8 : 4)
    setTimeout(() => setScreenShake(0), 150)
  }, [])

  const createHitEffect = useCallback((x: number, y: number) => {
    const hitEffect: HitEffect = {
      id: hitEffectIdRef.current++,
      x,
      y,
      frame: 0,
    }
    setHitEffects((prev) => [...prev, hitEffect])
  }, [])

  const startGame = useCallback(() => {
    setGameState("playing")
    setScore(0)
    setLevel(1)
    setCarX(GAME_WIDTH / 2 - CAR_WIDTH / 2)
    setCarHealth(3)
    setBullets([])
    setEnemyBullets([])
    setAliens([])
    setExplosions([])
    setHitEffects([])
    setScreenShake(0)
    setIsInvincible(false)
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
    let bossSpawnTimer = 0
    const baseSpawnInterval = 1500 // Slower spawn rate
    const bossSpawnInterval = 20000 // Boss every 20 seconds

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

      // Shoot - much faster fire rate with wave pattern
      if (keysRef.current.has(" ") || keysRef.current.has("ArrowUp")) {
        const now = performance.now()
        const fireRate = Math.max(100 - level * 5, 60) // Fast shooting
        if (now - lastShotRef.current > fireRate) {
          lastShotRef.current = now
          const bulletsToAdd: Bullet[] = []
          const centerX = carXRef.current + CAR_WIDTH / 2 - BULLET_WIDTH / 2
          const baseY = GAME_HEIGHT - CAR_HEIGHT - BULLET_HEIGHT - 20
          
          // Wave fire pattern - bullets spread outward in waves
          const bulletCount = level >= 6 ? 7 : level >= 3 ? 5 : 3
          const spreadAngle = level >= 6 ? 40 : level >= 3 ? 30 : 20
          
          for (let i = 0; i < bulletCount; i++) {
            const offset = (i - (bulletCount - 1) / 2) * (spreadAngle / (bulletCount - 1 || 1))
            bulletsToAdd.push({
              id: bulletIdRef.current++,
              x: centerX + offset,
              y: baseY + Math.abs(offset) * 0.3, // Slight arc at start
              startX: centerX + offset,
              startY: baseY,
            })
          }
          
          setBullets((prev) => [...prev, ...bulletsToAdd])
        }
      }

      // Move bullets - wave pattern motion
      setBullets((prev) =>
        prev
          .map((b) => {
            const distanceTraveled = b.startY - b.y
            const waveAmplitude = 15 // How wide the wave spreads
            const waveFrequency = 0.02 // How fast the wave oscillates
            const offsetFromCenter = b.startX - (carXRef.current + CAR_WIDTH / 2)
            const waveOffset = Math.sin(distanceTraveled * waveFrequency) * waveAmplitude * Math.sign(offsetFromCenter)
            
            return {
              ...b,
              x: b.startX + waveOffset + (offsetFromCenter * distanceTraveled * 0.003), // Spread outward + wave
              y: b.y - 16, // Fast upward movement
            }
          })
          .filter((b) => b.y > -BULLET_HEIGHT)
      )

      // Move enemy bullets - slower projectiles
      setEnemyBullets((prev) =>
        prev
          .map((b) => ({
            ...b,
            x: b.x + Math.sin(b.angle) * 3, // Slower enemy bullets
            y: b.y + Math.cos(b.angle) * 3,
          }))
          .filter((b) => b.y < GAME_HEIGHT + 20 && b.x > -20 && b.x < GAME_WIDTH + 20)
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

      // Spawn regular aliens - fewer at a time
      alienSpawnTimer += deltaTime
      const spawnInterval = Math.max(baseSpawnInterval - level * 30, 500)
      if (alienSpawnTimer > spawnInterval) {
        alienSpawnTimer = 0
        // Spawn only 1 alien at a time, max 2 at high levels
        const spawnCount = level >= 5 ? 2 : 1
        setAliens((prev) => {
          // Limit max aliens on screen
          if (prev.length >= 6) return prev
          const newAliens = [...prev]
          for (let i = 0; i < spawnCount && newAliens.length < 6; i++) {
            newAliens.push(spawnAlien(level, false))
          }
          return newAliens
        })
      }

      // Spawn bosses periodically
      bossSpawnTimer += deltaTime
      if (bossSpawnTimer > bossSpawnInterval && level >= 2) {
        bossSpawnTimer = 0
        setAliens((prev) => [...prev, spawnAlien(level, true)])
      }

      // Move aliens and make them shoot - SLOWER speeds
      setAliens((prev) => {
        const baseSpeed = 0.8 + level * 0.1 // Much slower base speed
        return prev.map((a) => {
          const isBoss = a.type >= 4
          const speed = isBoss ? baseSpeed * 0.5 : baseSpeed // Bosses even slower
          let newX = a.x
          let newY = a.y + speed
          const newPhase = a.movePhase + 0.05

          // Movement patterns - gentler movements
          if (a.movePattern === "zigzag") {
            newX = a.x + Math.sin(newPhase) * 1.5 // Reduced zigzag
          } else if (a.movePattern === "dive" && a.y > 150) {
            newY = a.y + speed * 1.2 // Reduced dive speed
          }

          // Keep within bounds
          newX = Math.max(0, Math.min(GAME_WIDTH - (isBoss ? BOSS_WIDTH : ALIEN_WIDTH), newX))

          // Enemy shooting
          const config = ALIEN_CONFIG[a.type as keyof typeof ALIEN_CONFIG]
          if (config.canShoot && currentTime - a.lastShot > config.shootRate) {
            const currentCarX = carXRef.current
            // Calculate angle to player
            const dx = (currentCarX + CAR_WIDTH / 2) - (newX + (isBoss ? BOSS_WIDTH : ALIEN_WIDTH) / 2)
            const dy = (GAME_HEIGHT - CAR_HEIGHT / 2) - newY
            const angle = Math.atan2(dx, dy)
            
            setEnemyBullets((prevBullets) => {
              const newBullets = [...prevBullets]
              if (isBoss) {
                // Bosses shoot multiple bullets
                const spreadAngles = a.type === 6 ? [-0.3, -0.15, 0, 0.15, 0.3] : 
                                     a.type === 5 ? [-0.2, 0, 0.2] : [-0.15, 0.15]
                spreadAngles.forEach((spread) => {
                  newBullets.push({
                    id: enemyBulletIdRef.current++,
                    x: newX + (isBoss ? BOSS_WIDTH : ALIEN_WIDTH) / 2,
                    y: newY + (isBoss ? BOSS_HEIGHT : ALIEN_HEIGHT),
                    angle: angle + spread,
                  })
                })
              } else {
                newBullets.push({
                  id: enemyBulletIdRef.current++,
                  x: newX + ALIEN_WIDTH / 2,
                  y: newY + ALIEN_HEIGHT,
                  angle,
                })
              }
              return newBullets
            })
            return { ...a, x: newX, y: newY, movePhase: newPhase, lastShot: currentTime }
          }

          return { ...a, x: newX, y: newY, movePhase: newPhase }
        })
      })

      // Update explosions
      setExplosions((prev) =>
        prev
          .map((e) => ({ ...e, frame: e.frame + 1 }))
          .filter((e) => e.frame < 20)
      )

      // Update hit effects
      setHitEffects((prev) =>
        prev
          .map((h) => ({ ...h, frame: h.frame + 1 }))
          .filter((h) => h.frame < 8)
      )

      // Check bullet-alien collisions
      setBullets((prevBullets) => {
        let bulletsToRemove = new Set<number>()
        
        setAliens((prevAliens) => {
          const newAliens = [...prevAliens]
          let scoreIncrease = 0

          prevBullets.forEach((bullet) => {
            newAliens.forEach((alien, index) => {
              const isBoss = alien.type >= 4
              const alienW = isBoss ? BOSS_WIDTH : ALIEN_WIDTH
              const alienH = isBoss ? BOSS_HEIGHT : ALIEN_HEIGHT
              
              if (
                bullet.x < alien.x + alienW &&
                bullet.x + BULLET_WIDTH > alien.x &&
                bullet.y < alien.y + alienH &&
                bullet.y + BULLET_HEIGHT > alien.y
              ) {
                bulletsToRemove.add(bullet.id)
                newAliens[index] = { ...alien, health: alien.health - 1 }
                
                // Create hit effect for visual feedback
                createHitEffect(bullet.x, bullet.y)
                
                if (newAliens[index].health <= 0) {
                  const config = ALIEN_CONFIG[alien.type as keyof typeof ALIEN_CONFIG]
                  createExplosion(
                    alien.x + alienW / 2,
                    alien.y + alienH / 2,
                    isBoss ? 120 : 60
                  )
                  scoreIncrease += config.points
                }
              }
            })
          })

          if (scoreIncrease > 0) {
            setScore((prev) => {
              const newScore = prev + scoreIncrease
              setLevel(Math.floor(newScore / 1000) + 1)
              return newScore
            })
          }

          return newAliens.filter((a) => a.health > 0)
        })

        return prevBullets.filter((b) => !bulletsToRemove.has(b.id))
      })

      // Check enemy bullet-car collisions
      setEnemyBullets((prevEnemyBullets) => {
        if (isInvincible) return prevEnemyBullets

        const currentCarX = carXRef.current
        let wasHit = false
        
        const remainingBullets = prevEnemyBullets.filter((bullet) => {
          const hit =
            bullet.x > currentCarX &&
            bullet.x < currentCarX + CAR_WIDTH &&
            bullet.y > GAME_HEIGHT - CAR_HEIGHT - 20 &&
            bullet.y < GAME_HEIGHT - 20

          if (hit) {
            wasHit = true
            createExplosion(bullet.x, bullet.y, 30)
          }
          return !hit
        })

        if (wasHit) {
          setCarHealth((prev) => {
            const newHealth = prev - 1
            if (newHealth <= 0) {
              setScore((currentScore) => {
                setHighScore((prevHigh) => Math.max(prevHigh, currentScore))
                return currentScore
              })
              setGameState("gameover")
            }
            return newHealth
          })
          setIsInvincible(true)
          setTimeout(() => setIsInvincible(false), 1500)
        }

        return remainingBullets
      })

      // Check alien-car collision
      setAliens((prevAliens) => {
        if (isInvincible) return prevAliens.filter((a) => a.y < GAME_HEIGHT + ALIEN_HEIGHT)

        const currentCarX = carXRef.current
        let wasHit = false

        prevAliens.forEach((alien) => {
          const isBoss = alien.type >= 4
          const alienW = isBoss ? BOSS_WIDTH : ALIEN_WIDTH
          const alienH = isBoss ? BOSS_HEIGHT : ALIEN_HEIGHT
          
          // Check car collision
          if (
            alien.x < currentCarX + CAR_WIDTH &&
            alien.x + alienW > currentCarX &&
            alien.y + alienH > GAME_HEIGHT - CAR_HEIGHT - 20 &&
            alien.y < GAME_HEIGHT - 20
          ) {
            wasHit = true
            createExplosion(alien.x + alienW / 2, alien.y + alienH / 2, 80)
          }

          // Check if alien reached bottom
          if (alien.y + alienH > GAME_HEIGHT) {
            wasHit = true
          }
        })

        if (wasHit) {
          setCarHealth((prev) => {
            const newHealth = prev - 1
            if (newHealth <= 0) {
              setScore((currentScore) => {
                setHighScore((prevHigh) => Math.max(prevHigh, currentScore))
                return currentScore
              })
              setGameState("gameover")
            }
            return newHealth
          })
          setIsInvincible(true)
          setTimeout(() => setIsInvincible(false), 1500)
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
  }, [gameState, level, spawnAlien, createExplosion, createHitEffect, isInvincible])

  const renderAlien = (alien: Alien) => {
    const isBoss = alien.type >= 4
    const width = isBoss ? BOSS_WIDTH : ALIEN_WIDTH
    const height = isBoss ? BOSS_HEIGHT : ALIEN_HEIGHT
    const config = ALIEN_CONFIG[alien.type as keyof typeof ALIEN_CONFIG]

    return (
      <div
        key={alien.id}
        className="absolute"
        style={{
          left: alien.x,
          top: alien.y,
          width,
          height,
        }}
      >
        <svg viewBox="0 0 50 50" className="w-full h-full">
          {alien.type === 1 && (
            // Scout - green, simple
            <g style={{ filter: "drop-shadow(0 0 6px #00ff88)" }}>
              <ellipse cx="25" cy="25" rx="20" ry="15" fill="#0a3a2a" stroke="#00ff88" strokeWidth="2" />
              <circle cx="18" cy="22" r="5" fill="#00ff88" />
              <circle cx="32" cy="22" r="5" fill="#00ff88" />
              <circle cx="18" cy="22" r="2" fill="#0a3a2a" />
              <circle cx="32" cy="22" r="2" fill="#0a3a2a" />
            </g>
          )}
          {alien.type === 2 && (
            // Fighter - orange, angular
            <g style={{ filter: "drop-shadow(0 0 6px #ff6b35)" }}>
              <path d="M5 40 L15 10 L25 25 L35 10 L45 40 L25 35 Z" fill="#3a1a0a" stroke="#ff6b35" strokeWidth="2" />
              <circle cx="18" cy="25" r="4" fill="#ff6b35" />
              <circle cx="32" cy="25" r="4" fill="#ff6b35" />
              <rect x="22" y="38" width="6" height="8" fill="#ff6b35" opacity="0.8">
                <animate attributeName="opacity" values="0.8;0.4;0.8" dur="0.3s" repeatCount="indefinite" />
              </rect>
            </g>
          )}
          {alien.type === 3 && (
            // Hunter - red, aggressive
            <g style={{ filter: "drop-shadow(0 0 8px #ff2255)" }}>
              <polygon points="25,5 45,20 40,45 10,45 5,20" fill="#3a0a1a" stroke="#ff2255" strokeWidth="2" />
              <circle cx="17" cy="25" r="6" fill="#ff2255" />
              <circle cx="33" cy="25" r="6" fill="#ff2255" />
              <circle cx="17" cy="25" r="3" fill="#ffffff" />
              <circle cx="33" cy="25" r="3" fill="#ffffff" />
              <path d="M15 38 L25 32 L35 38" stroke="#ff2255" strokeWidth="3" fill="none" />
            </g>
          )}
          {alien.type === 4 && (
            // Destroyer Boss - purple
            <g style={{ filter: "drop-shadow(0 0 12px #aa00ff)" }}>
              <path d="M5 45 L10 5 L25 15 L40 5 L45 45 L25 40 Z" fill="#2a0a3a" stroke="#aa00ff" strokeWidth="3" />
              <circle cx="15" cy="25" r="8" fill="#aa00ff" />
              <circle cx="35" cy="25" r="8" fill="#aa00ff" />
              <circle cx="15" cy="25" r="4" fill="#ff00ff" />
              <circle cx="35" cy="25" r="4" fill="#ff00ff" />
              <rect x="20" y="35" width="10" height="12" fill="#aa00ff">
                <animate attributeName="fill" values="#aa00ff;#ff00ff;#aa00ff" dur="0.5s" repeatCount="indefinite" />
              </rect>
            </g>
          )}
          {alien.type === 5 && (
            // Annihilator Boss - pink/magenta
            <g style={{ filter: "drop-shadow(0 0 15px #ff00aa)" }}>
              <polygon points="25,2 48,15 45,40 30,48 20,48 5,40 2,15" fill="#3a0a2a" stroke="#ff00aa" strokeWidth="3" />
              <circle cx="15" cy="22" r="7" fill="#ff00aa" />
              <circle cx="35" cy="22" r="7" fill="#ff00aa" />
              <circle cx="25" cy="32" r="5" fill="#ff00aa" />
              <path d="M10 42 L25 35 L40 42" stroke="#ff00aa" strokeWidth="4" fill="none">
                <animate attributeName="stroke" values="#ff00aa;#ffffff;#ff00aa" dur="0.3s" repeatCount="indefinite" />
              </path>
            </g>
          )}
          {alien.type === 6 && (
            // Overlord Boss - gold/orange
            <g style={{ filter: "drop-shadow(0 0 20px #ffaa00)" }}>
              <polygon points="25,0 50,12 48,38 35,50 15,50 2,38 0,12" fill="#3a2a0a" stroke="#ffaa00" strokeWidth="4" />
              <circle cx="12" cy="20" r="8" fill="#ffaa00" />
              <circle cx="38" cy="20" r="8" fill="#ffaa00" />
              <circle cx="25" cy="30" r="6" fill="#ffaa00" />
              <circle cx="12" cy="20" r="4" fill="#ff0000" />
              <circle cx="38" cy="20" r="4" fill="#ff0000" />
              <circle cx="25" cy="30" r="3" fill="#ff0000" />
              <path d="M8 45 L25 38 L42 45" stroke="#ffaa00" strokeWidth="5" fill="none">
                <animate attributeName="stroke" values="#ffaa00;#ff0000;#ffaa00" dur="0.2s" repeatCount="indefinite" />
              </path>
            </g>
          )}
        </svg>
        {/* Health bar for enemies with health > 1 */}
        {alien.maxHealth > 1 && (
          <div 
            className="absolute -top-3 left-1/2 -translate-x-1/2"
            style={{ width: isBoss ? 70 : 40 }}
          >
            <div 
              className="h-2 rounded-full"
              style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${config.color}` }}
            >
              <div 
                className="h-full rounded-full transition-all duration-150"
                style={{ 
                  width: `${(alien.health / alien.maxHealth) * 100}%`,
                  background: config.color,
                  boxShadow: `0 0 6px ${config.color}`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div
        ref={containerRef}
        tabIndex={0}
        className="relative outline-none"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      >
        {/* Game container with border and screen shake */}
        <div
          className="absolute inset-0 rounded-lg overflow-hidden transition-transform duration-75"
          style={{
            background: "linear-gradient(180deg, #0a0a1a 0%, #0f1629 50%, #0a0a1a 100%)",
            boxShadow: "0 0 40px rgba(0, 200, 255, 0.2), inset 0 0 60px rgba(0, 0, 0, 0.5)",
            border: "2px solid rgba(0, 200, 255, 0.3)",
            transform: screenShake ? `translate(${(Math.random() - 0.5) * screenShake}px, ${(Math.random() - 0.5) * screenShake}px)` : 'none',
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
                HIGH: {highScore.toString().padStart(6, "0")}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
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
              {/* Health display */}
              <div className="flex gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded"
                    style={{
                      background: i < carHealth ? "#ff2255" : "rgba(255, 34, 85, 0.2)",
                      boxShadow: i < carHealth ? "0 0 8px #ff2255" : "none",
                      border: "1px solid #ff2255",
                    }}
                  />
                ))}
              </div>
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
                opacity: isInvincible ? 0.5 : 1,
                animation: isInvincible ? "pulse 0.2s infinite" : "none",
              }}
            >
              <svg
                viewBox="0 0 60 80"
                className="w-full h-full"
                style={{ filter: "drop-shadow(0 0 8px #00c8ff)" }}
              >
                <path
                  d="M10 70 L10 35 L15 20 L25 10 L35 10 L45 20 L50 35 L50 70 Z"
                  fill="#1a2a4a"
                  stroke="#00c8ff"
                  strokeWidth="2"
                />
                <path
                  d="M20 35 L20 20 L25 15 L35 15 L40 20 L40 35 Z"
                  fill="#00c8ff"
                  opacity="0.6"
                />
                <ellipse cx="20" cy="75" rx="6" ry="8" fill="#ff6b35" opacity="0.8">
                  <animate attributeName="opacity" values="0.8;0.4;0.8" dur="0.2s" repeatCount="indefinite" />
                </ellipse>
                <ellipse cx="40" cy="75" rx="6" ry="8" fill="#ff6b35" opacity="0.8">
                  <animate attributeName="opacity" values="0.4;0.8;0.4" dur="0.2s" repeatCount="indefinite" />
                </ellipse>
                <rect x="5" y="50" width="8" height="20" rx="2" fill="#0a1a3a" stroke="#00c8ff" strokeWidth="1" />
                <rect x="47" y="50" width="8" height="20" rx="2" fill="#0a1a3a" stroke="#00c8ff" strokeWidth="1" />
                <rect x="12" y="8" width="4" height="12" fill="#ff6b35" />
                <rect x="44" y="8" width="4" height="12" fill="#ff6b35" />
              </svg>
            </div>
          )}

          {/* Player Bullets - Wave pattern */}
          {bullets.map((bullet) => (
            <div
              key={bullet.id}
              className="absolute"
              style={{
                left: bullet.x,
                top: bullet.y,
                width: BULLET_WIDTH + 2,
                height: BULLET_HEIGHT,
              }}
            >
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: "linear-gradient(180deg, #00ffff 0%, #00c8ff 50%, #ff6b35 100%)",
                  boxShadow: "0 0 12px #00c8ff, 0 0 24px #00c8ff, 0 -5px 15px #ff6b35",
                }}
              />
            </div>
          ))}

          {/* Enemy Bullets */}
          {enemyBullets.map((bullet) => (
            <div
              key={bullet.id}
              className="absolute"
              style={{
                left: bullet.x - ENEMY_BULLET_SIZE / 2,
                top: bullet.y - ENEMY_BULLET_SIZE / 2,
                width: ENEMY_BULLET_SIZE,
                height: ENEMY_BULLET_SIZE,
              }}
            >
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: "radial-gradient(circle, #ff2255 0%, #aa0033 100%)",
                  boxShadow: "0 0 8px #ff2255, 0 0 16px #ff2255",
                }}
              />
            </div>
          ))}

          {/* Aliens */}
          {aliens.map(renderAlien)}

          {/* Explosions - enhanced animation */}
          {explosions.map((explosion) => (
            <div
              key={explosion.id}
              className="absolute pointer-events-none"
              style={{
                left: explosion.x - explosion.size / 2,
                top: explosion.y - explosion.size / 2,
                width: explosion.size,
                height: explosion.size,
              }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Outer ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={10 + explosion.frame * 3}
                  fill="none"
                  stroke="#ff6b35"
                  strokeWidth={Math.max(4 - explosion.frame * 0.2, 0.5)}
                  opacity={Math.max(1 - explosion.frame * 0.05, 0)}
                  style={{ filter: "drop-shadow(0 0 15px #ff6b35)" }}
                />
                {/* Middle ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={5 + explosion.frame * 2}
                  fill="none"
                  stroke="#ffaa00"
                  strokeWidth={Math.max(3 - explosion.frame * 0.15, 0.5)}
                  opacity={Math.max(0.9 - explosion.frame * 0.045, 0)}
                  style={{ filter: "drop-shadow(0 0 10px #ffaa00)" }}
                />
                {/* Core glow */}
                <circle
                  cx="50"
                  cy="50"
                  r={Math.max(8 - explosion.frame * 0.4, 0)}
                  fill="#ffffff"
                  opacity={Math.max(0.8 - explosion.frame * 0.04, 0)}
                />
                {/* Particle bursts */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                  <circle
                    key={i}
                    cx={50 + Math.cos((angle * Math.PI) / 180) * (explosion.frame * 2.5)}
                    cy={50 + Math.sin((angle * Math.PI) / 180) * (explosion.frame * 2.5)}
                    r={Math.max(3 - explosion.frame * 0.15, 0)}
                    fill="#ff6b35"
                    opacity={Math.max(0.8 - explosion.frame * 0.04, 0)}
                  />
                ))}
              </svg>
            </div>
          ))}

          {/* Hit Effects - spark flashes when bullets hit */}
          {hitEffects.map((hit) => (
            <div
              key={hit.id}
              className="absolute pointer-events-none"
              style={{
                left: hit.x - 15,
                top: hit.y - 15,
                width: 30,
                height: 30,
              }}
            >
              <svg viewBox="0 0 30 30" className="w-full h-full">
                {/* Flash core */}
                <circle
                  cx="15"
                  cy="15"
                  r={8 - hit.frame}
                  fill="#ffffff"
                  opacity={Math.max(1 - hit.frame * 0.12, 0)}
                />
                {/* Spark rays */}
                {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                  <line
                    key={i}
                    x1="15"
                    y1="15"
                    x2={15 + Math.cos((angle * Math.PI) / 180) * (8 + hit.frame * 2)}
                    y2={15 + Math.sin((angle * Math.PI) / 180) * (8 + hit.frame * 2)}
                    stroke="#00ffff"
                    strokeWidth={Math.max(2 - hit.frame * 0.2, 0.5)}
                    opacity={Math.max(0.9 - hit.frame * 0.1, 0)}
                    style={{ filter: "drop-shadow(0 0 4px #00ffff)" }}
                  />
                ))}
              </svg>
            </div>
          ))}

          {/* Start Screen */}
          {gameState === "start" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-500">
              <h1
                className="text-5xl font-mono font-bold mb-4 tracking-widest animate-in slide-in-from-top-4 duration-700"
                style={{
                  color: "#00c8ff",
                  textShadow: "0 0 20px #00c8ff, 0 0 40px #00c8ff",
                  animation: "pulse 2s ease-in-out infinite",
                }}
              >
                SPACE CAR
              </h1>
              <h2
                className="text-3xl font-mono mb-8 animate-in slide-in-from-top-4 duration-700 delay-150"
                style={{
                  color: "#ff6b35",
                  textShadow: "0 0 15px #ff6b35",
                }}
              >
                DEFENDER
              </h2>
              
              <div className="flex flex-col gap-2 mb-8 text-center animate-in fade-in duration-700 delay-300">
                <p className="text-foreground/70 font-mono text-sm">
                  Use <span style={{ color: "#00c8ff" }}>Arrow Keys</span> or <span style={{ color: "#00c8ff" }}>A D</span> to move
                </p>
                <p className="text-foreground/70 font-mono text-sm">
                  Press <span style={{ color: "#00c8ff" }}>SPACE</span> or <span style={{ color: "#00c8ff" }}>UP</span> to shoot
                </p>
                <p className="text-foreground/70 font-mono text-sm mt-2">
                  Dodge enemy fire and destroy all aliens!
                </p>
              </div>

              <button
                onClick={startGame}
                className="px-8 py-4 font-mono text-xl font-bold rounded-lg transition-all duration-200 hover:scale-110 hover:brightness-110 active:scale-95 animate-in zoom-in duration-500 delay-500"
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
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
              <h1
                className="text-5xl font-mono font-bold mb-4 tracking-widest animate-in zoom-in duration-500"
                style={{
                  color: "#ff2255",
                  textShadow: "0 0 20px #ff2255, 0 0 40px #ff2255",
                  animation: "shake 0.5s ease-in-out",
                }}
              >
                GAME OVER
              </h1>
              
              <div className="flex flex-col gap-4 mb-8 text-center animate-in slide-in-from-bottom-4 duration-500 delay-200">
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
                    className="text-lg font-mono"
                    style={{ 
                      color: "#00ff88", 
                      textShadow: "0 0 10px #00ff88",
                      animation: "pulse 0.5s ease-in-out infinite",
                    }}
                  >
                    NEW HIGH SCORE!
                  </p>
                )}
              </div>

              <button
                onClick={startGame}
                className="px-8 py-4 font-mono text-xl font-bold rounded-lg transition-all duration-200 hover:scale-110 hover:brightness-110 active:scale-95 animate-in zoom-in duration-500 delay-500"
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
              Arrows: Move | SPACE: Shoot | Avoid red bullets!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
