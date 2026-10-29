/*
 * Overhauled High-Impact Weather Particle Engine for Emerald Studio
 * Features:
 * - Rain (bold cyan streaks + splash ripples)
 * - Thunderstorm (torrential rain + realistic multi-flash lightning strikes)
 * - Snow & Blizzard (thick fluffy flakes drifting with wind physics)
 * - Volcanic Ash (swirling dark soot flakes)
 * - Sunny (radiant golden sunbeams and warm daylight)
 * - Fog (rolling misty cloud banks)
 */

(function(window) {
  "use strict";

  class WeatherEngine {
    constructor(canvas, lightningElement) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.lightning = lightningElement;
      this.activeWeather = "sunny";
      this.particles = [];
      this.splashes = [];
      this.lightningTimer = 0;
      this.sunbeamAngle = 0;
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.animId = null;

      this.resize();
      window.addEventListener("resize", () => this.resize());
      this.start();
    }

    resize() {
      this.width = this.canvas.width = window.innerWidth;
      this.height = this.canvas.height = window.innerHeight;
      this.initParticles();
    }

    setWeather(type) {
      this.activeWeather = type;
      this.initParticles();
    }

    initParticles() {
      this.particles = [];
      this.splashes = [];
      const count = this.getParticleCount();

      for (let i = 0; i < count; i++) {
        this.particles.push(this.createParticle(true));
      }
    }

    getParticleCount() {
      switch (this.activeWeather) {
        case "rain": return 250;
        case "downpour": return 400;
        case "thunderstorm": return 450;
        case "snow": return 200;
        case "ash": return 160;
        case "sandstorm": return 250;
        default: return 0;
      }
    }

    createParticle(randomY = false) {
      const y = randomY ? Math.random() * this.height : -30;
      const x = Math.random() * (this.width + 300) - 150;

      switch (this.activeWeather) {
        case "rain":
        case "downpour":
        case "thunderstorm":
          const speedMul = this.activeWeather === "downpour" ? 1.4 : (this.activeWeather === "thunderstorm" ? 1.6 : 1.1);
          return {
            x, y,
            len: (22 + Math.random() * 18) * speedMul,
            speedY: (18 + Math.random() * 10) * speedMul,
            speedX: -4 * speedMul,
            opacity: 0.55 + Math.random() * 0.4,
            width: 1.8 + Math.random() * 1.0,
            type: "rain"
          };

        case "snow":
          return {
            x, y,
            radius: 2.2 + Math.random() * 4.5,
            speedY: 1.8 + Math.random() * 2.8,
            speedX: -1.0 + Math.random() * 1.5,
            angle: Math.random() * Math.PI * 2,
            angleSpeed: 0.02 + Math.random() * 0.04,
            swing: 1.5 + Math.random() * 2.5,
            opacity: 0.65 + Math.random() * 0.35,
            type: "snow"
          };

        case "ash":
          return {
            x, y,
            size: 3.0 + Math.random() * 4.5,
            speedY: 1.2 + Math.random() * 2.2,
            speedX: -1.2 + Math.random() * 1.0,
            angle: Math.random() * Math.PI * 2,
            angleSpeed: 0.03 + Math.random() * 0.05,
            opacity: 0.5 + Math.random() * 0.45,
            color: Math.random() > 0.3 ? "rgba(80, 85, 95," : "rgba(185, 115, 60,",
            type: "ash"
          };

        default:
          return { x: 0, y: 0, speedY: 0, speedX: 0, opacity: 0 };
      }
    }

    triggerSplash(x, y) {
      if (this.splashes.length > 60) return;
      for (let i = 0; i < 3; i++) {
        this.splashes.push({
          x, y,
          vx: (Math.random() - 0.5) * 4,
          vy: -(2 + Math.random() * 3),
          life: 1.0,
          decay: 0.12 + Math.random() * 0.08,
          radius: 1.2 + Math.random() * 1.2
        });
      }
    }

    start() {
      const render = () => {
        this.update();
        this.draw();
        this.animId = requestAnimationFrame(render);
      };
      this.animId = requestAnimationFrame(render);
    }

    update() {
      // Thunderstorm lightning strikes
      if (this.activeWeather === "thunderstorm") {
        this.lightningTimer++;
        if (this.lightningTimer > 120 && Math.random() < 0.025) {
          this.triggerLightning();
          this.lightningTimer = 0;
        }
      }

      // Update splashes
      for (let i = this.splashes.length - 1; i >= 0; i--) {
        const s = this.splashes[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.3; // Gravity
        s.life -= s.decay;
        if (s.life <= 0) {
          this.splashes.splice(i, 1);
        }
      }

      // Update particles
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];

        if (p.type === "rain") {
          p.x += p.speedX;
          p.y += p.speedY;

          if (p.y > this.height - 20) {
            if (Math.random() < 0.25) this.triggerSplash(p.x, this.height - 10);
          }

          if (p.y > this.height + 25 || p.x < -60) {
            this.particles[i] = this.createParticle(false);
          }
        } else if (p.type === "snow") {
          p.angle += p.angleSpeed;
          p.x += Math.sin(p.angle) * p.swing + p.speedX;
          p.y += p.speedY;
          if (p.y > this.height + 15) {
            this.particles[i] = this.createParticle(false);
          }
        } else if (p.type === "ash") {
          p.angle += p.angleSpeed;
          p.x += Math.cos(p.angle) * 1.6 + p.speedX;
          p.y += p.speedY;
          if (p.y > this.height + 15) {
            this.particles[i] = this.createParticle(false);
          }
        }
      }
    }

    triggerLightning() {
      if (!this.lightning) return;
      this.lightning.style.opacity = "0.85";
      setTimeout(() => {
        this.lightning.style.opacity = "0.2";
        setTimeout(() => {
          this.lightning.style.opacity = "0.75";
          setTimeout(() => {
            this.lightning.style.opacity = "0";
          }, 80);
        }, 50);
      }, 60);
    }

    draw() {
      this.ctx.clearRect(0, 0, this.width, this.height);

      if (this.activeWeather === "sunny") {
        this.drawSunbeams();
        return;
      }

      if (this.activeWeather === "fog") {
        this.drawFog();
        return;
      }

      // Ambient weather screen tints
      if (this.activeWeather === "snow") {
        this.ctx.fillStyle = "rgba(220, 240, 255, 0.08)";
        this.ctx.fillRect(0, 0, this.width, this.height);
      } else if (this.activeWeather === "thunderstorm" || this.activeWeather === "downpour") {
        this.ctx.fillStyle = "rgba(10, 20, 35, 0.22)";
        this.ctx.fillRect(0, 0, this.width, this.height);
      } else if (this.activeWeather === "rain") {
        this.ctx.fillStyle = "rgba(15, 30, 45, 0.12)";
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      // Draw splashes
      for (const s of this.splashes) {
        this.ctx.fillStyle = `rgba(180, 230, 255, ${s.life * 0.75})`;
        this.ctx.beginPath();
        this.ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Draw particles
      for (const p of this.particles) {
        if (p.type === "rain") {
          this.ctx.strokeStyle = `rgba(175, 230, 255, ${p.opacity})`;
          this.ctx.lineWidth = p.width;
          this.ctx.lineCap = "round";
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p.x + p.speedX * (p.len / 12), p.y + p.len);
          this.ctx.stroke();
        } else if (p.type === "snow") {
          this.ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (p.type === "ash") {
          this.ctx.fillStyle = `${p.color} ${p.opacity})`;
          this.ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      }
    }

    drawSunbeams() {
      this.sunbeamAngle += 0.005;
      const grad = this.ctx.createLinearGradient(0, 0, this.width, this.height);
      grad.addColorStop(0, "rgba(255, 235, 140, 0.18)");
      grad.addColorStop(0.4, "rgba(255, 215, 100, 0.08)");
      grad.addColorStop(1, "rgba(255, 190, 60, 0.03)");
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Light beam rays
      this.ctx.save();
      this.ctx.fillStyle = "rgba(255, 250, 200, 0.06)";
      for (let i = 0; i < 5; i++) {
        const offset = Math.sin(this.sunbeamAngle + i) * 60;
        this.ctx.beginPath();
        this.ctx.moveTo(i * (this.width / 4) + offset, 0);
        this.ctx.lineTo(i * (this.width / 4) + 120 + offset, 0);
        this.ctx.lineTo(i * (this.width / 4) + 260 + offset, this.height);
        this.ctx.lineTo(i * (this.width / 4) + 100 + offset, this.height);
        this.ctx.closePath();
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    drawFog() {
      const grad = this.ctx.createRadialGradient(
        this.width / 2, this.height / 2, 80,
        this.width / 2, this.height / 2, this.width * 0.8
      );
      grad.addColorStop(0, "rgba(210, 225, 245, 0.1)");
      grad.addColorStop(0.6, "rgba(190, 210, 235, 0.28)");
      grad.addColorStop(1, "rgba(170, 195, 220, 0.42)");
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  window.WeatherEngine = WeatherEngine;
})(window);
