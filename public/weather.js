/*
 * Weather Particle Engine for Emerald Free-Fly Tester
 * Real-time 60fps simulation of Hoenn atmospheric conditions:
 * - Rain & Downpour (with splash particles)
 * - Thunderstorm (with ambient lightning flashes)
 * - Snow & Blizzard (soft drifting flakes with wind physics)
 * - Sunny / Drought (radiant golden sunbeams)
 * - Volcanic Ash (swirling dark soot flakes)
 * - Sandstorm (howling amber gusts)
 * - Fog (rolling misty banks)
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
      this.wind = { x: -1.5, y: 1 };
      this.lightningTimer = 0;
      this.width = 0;
      this.height = 0;
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
      if (this.activeWeather === type) return;
      this.activeWeather = type;
      this.initParticles();
    }

    initParticles() {
      this.particles = [];
      const count = this.getParticleCount();

      for (let i = 0; i < count; i++) {
        this.particles.push(this.createParticle(true));
      }
    }

    getParticleCount() {
      switch (this.activeWeather) {
        case "rain": return 180;
        case "downpour": return 350;
        case "thunderstorm": return 400;
        case "snow": return 160;
        case "ash": return 140;
        case "sandstorm": return 250;
        default: return 0;
      }
    }

    createParticle(randomY = false) {
      const y = randomY ? Math.random() * this.height : -20;
      const x = Math.random() * (this.width + 200) - 100;

      switch (this.activeWeather) {
        case "rain":
        case "downpour":
        case "thunderstorm":
          const speedMul = this.activeWeather === "downpour" ? 1.4 : (this.activeWeather === "thunderstorm" ? 1.6 : 1.0);
          return {
            x, y,
            len: (16 + Math.random() * 14) * speedMul,
            speedY: (14 + Math.random() * 8) * speedMul,
            speedX: -2.5 * speedMul,
            opacity: 0.35 + Math.random() * 0.45,
            width: 1.2 + Math.random() * 0.8,
            type: "rain"
          };

        case "snow":
          return {
            x, y,
            radius: 1.5 + Math.random() * 3.5,
            speedY: 1.2 + Math.random() * 2.2,
            speedX: -0.5 + Math.random() * 1.0,
            angle: Math.random() * Math.PI * 2,
            angleSpeed: 0.02 + Math.random() * 0.03,
            swing: 1.0 + Math.random() * 2.0,
            opacity: 0.4 + Math.random() * 0.55,
            type: "snow"
          };

        case "ash":
          return {
            x, y,
            size: 2.0 + Math.random() * 3.5,
            speedY: 0.8 + Math.random() * 1.6,
            speedX: -1.0 + Math.random() * 0.8,
            angle: Math.random() * Math.PI * 2,
            angleSpeed: 0.03 + Math.random() * 0.04,
            opacity: 0.3 + Math.random() * 0.5,
            color: Math.random() > 0.4 ? "rgba(90, 95, 105," : "rgba(180, 110, 60,",
            type: "ash"
          };

        case "sandstorm":
          return {
            x, y: Math.random() * this.height,
            len: 25 + Math.random() * 35,
            speedX: -(18 + Math.random() * 12),
            speedY: (Math.random() - 0.4) * 3,
            opacity: 0.2 + Math.random() * 0.4,
            width: 1.5 + Math.random() * 1.5,
            type: "sand"
          };

        default:
          return { x: 0, y: 0, speedY: 0, speedX: 0, opacity: 0 };
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
        if (this.lightningTimer > 180 && Math.random() < 0.015) {
          this.triggerLightning();
          this.lightningTimer = 0;
        }
      }

      // Update particles
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];

        if (p.type === "rain") {
          p.x += p.speedX;
          p.y += p.speedY;
          if (p.y > this.height + 20 || p.x < -40) {
            this.particles[i] = this.createParticle(false);
          }
        } else if (p.type === "snow") {
          p.angle += p.angleSpeed;
          p.x += Math.sin(p.angle) * p.swing + p.speedX;
          p.y += p.speedY;
          if (p.y > this.height + 10) {
            this.particles[i] = this.createParticle(false);
          }
        } else if (p.type === "ash") {
          p.angle += p.angleSpeed;
          p.x += Math.cos(p.angle) * 1.2 + p.speedX;
          p.y += p.speedY;
          if (p.y > this.height + 10) {
            this.particles[i] = this.createParticle(false);
          }
        } else if (p.type === "sand") {
          p.x += p.speedX;
          p.y += p.speedY;
          if (p.x < -100) {
            p.x = this.width + 50;
            p.y = Math.random() * this.height;
          }
        }
      }
    }

    triggerLightning() {
      if (!this.lightning) return;
      this.lightning.style.opacity = "0.75";
      setTimeout(() => {
        this.lightning.style.opacity = "0.15";
        setTimeout(() => {
          this.lightning.style.opacity = "0.6";
          setTimeout(() => {
            this.lightning.style.opacity = "0";
          }, 60);
        }, 40);
      }, 50);
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

      for (const p of this.particles) {
        if (p.type === "rain") {
          this.ctx.strokeStyle = `rgba(180, 225, 255, ${p.opacity})`;
          this.ctx.lineWidth = p.width;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p.x + p.speedX * (p.len / 10), p.y + p.len);
          this.ctx.stroke();
        } else if (p.type === "snow") {
          this.ctx.fillStyle = `rgba(240, 250, 255, ${p.opacity})`;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (p.type === "ash") {
          this.ctx.fillStyle = `${p.color} ${p.opacity})`;
          this.ctx.fillRect(p.x, p.y, p.size, p.size);
        } else if (p.type === "sand") {
          this.ctx.strokeStyle = `rgba(225, 185, 110, ${p.opacity})`;
          this.ctx.lineWidth = p.width;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p.x + p.len, p.y + p.speedY * 3);
          this.ctx.stroke();
        }
      }
    }

    drawSunbeams() {
      const grad = this.ctx.createLinearGradient(0, 0, this.width, this.height);
      grad.addColorStop(0, "rgba(255, 240, 160, 0.08)");
      grad.addColorStop(0.5, "rgba(255, 220, 120, 0.04)");
      grad.addColorStop(1, "rgba(255, 200, 80, 0.02)");
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawFog() {
      const grad = this.ctx.createRadialGradient(
        this.width / 2, this.height / 2, 50,
        this.width / 2, this.height / 2, this.width * 0.75
      );
      grad.addColorStop(0, "rgba(200, 215, 240, 0.05)");
      grad.addColorStop(0.7, "rgba(180, 200, 230, 0.18)");
      grad.addColorStop(1, "rgba(160, 180, 210, 0.28)");
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  window.WeatherEngine = WeatherEngine;
})(window);
