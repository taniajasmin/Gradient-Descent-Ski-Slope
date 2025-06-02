const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game variables
let game = {
    width: canvas.width,
    height: canvas.height,
    learningRate: 0.1,
    score: 0,
    gameOver: false,
    won: false,
    gravity: 0.5
};

// Snowboarder object with physics
let snowboarder = {
    x: 50,
    y: 50,
    width: 30,
    height: 30,
    vx: 0,
    vy: 0,
    onGround: true,
    momentum: 0,
    trail: [],
    image: new Image()
};

// Load snowboarder image
snowboarder.image.src = 'snowboarder.png';

// Lodge (goal)
let lodge = {
    x: game.width - 100,
    y: 0,
    width: 60,
    height: 50
};

// Holes
let holes = [
    {x: 300, radius: 25},
    {x: 500, radius: 25}
];

// Smooth bump function
function smoothBump(x, center, width, height) {
    const dist = Math.abs(x - center);
    if (dist > width) return 0;
    return height * (1 + Math.cos(Math.PI * dist / width)) / 2;
}

// Smoother terrain function
function terrainFunction(x) {
    // Gentler base terrain
    let y = game.height * 0.35 + 
           Math.sin(x * 0.006) * 25 +
           Math.sin(x * 0.003) * 40 -
           x * 0.08;
    
    // Smooth ramps before holes
    holes.forEach(hole => {
        y -= smoothBump(x, hole.x - 80, 60, 25);
    });
    
    return Math.min(y, game.height - 50);
}

// Calculate gradient with smoothing
function calculateGradient(x) {
    const h = 8;
    const y1 = terrainFunction(x - h);
    const y2 = terrainFunction(x + h);
    return (y2 - y1) / (2 * h);
}

// Draw terrain
function drawTerrain() {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(0, game.height);
    
    for (let x = 0; x <= game.width; x += 1) {
        const y = terrainFunction(x);
        ctx.lineTo(x, y);
    }
    
    ctx.lineTo(game.width, game.height);
    ctx.closePath();
    ctx.fill();
    
    // Draw holes as depressions
    ctx.fillStyle = '#4169E1';
    holes.forEach(hole => {
        const holeY = terrainFunction(hole.x);
        ctx.beginPath();
        ctx.arc(hole.x, holeY + 15, hole.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Draw snowboarder
function drawSnowboarder() {
    ctx.save();
    
    let angle;
    if (snowboarder.onGround) {
        const gradient = calculateGradient(snowboarder.x);
        angle = Math.atan(gradient);
    } else {
        angle = Math.atan2(snowboarder.vy, snowboarder.vx);
    }
    
    ctx.translate(snowboarder.x, snowboarder.y);
    ctx.rotate(angle);
    
    if (snowboarder.image.complete) {
        ctx.drawImage(snowboarder.image, 
            -snowboarder.width/2, 
            -snowboarder.height/2, 
            snowboarder.width, 
            snowboarder.height
        );
    } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(-snowboarder.width/2, -snowboarder.height/2, 
                     snowboarder.width, snowboarder.height);
    }
    
    ctx.restore();
    
    // Draw trail
    ctx.strokeStyle = snowboarder.onGround ? 'rgba(100, 100, 255, 0.3)' : 'rgba(255, 100, 100, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    snowboarder.trail.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
}

// Draw lodge
function drawLodge() {
    lodge.y = terrainFunction(lodge.x) - lodge.height;
    ctx.font = '40px Arial';
    ctx.fillText('🏠', lodge.x, lodge.y + 40);
}

// SIMPLIFIED & FIXED update function
function updateSnowboarder() {
    if (game.gameOver || game.won) return;
    
    const terrainY = terrainFunction(snowboarder.x);
    const gradient = calculateGradient(snowboarder.x);
    
    // If on ground
    if (snowboarder.onGround) {
        // Build momentum on downhills
        if (gradient > 0.05) {
            snowboarder.momentum = Math.min(snowboarder.momentum + 0.1, 2);
        } else if (gradient < -0.05) {
            snowboarder.momentum = Math.max(snowboarder.momentum - 0.1, 0);
        }
        
        // FIXED: Simple, clear physics
        // Base physics: gravity pulls you down slopes
        const gravityPull = gradient * 300;
        
        // Learning rate is your "engine power" - directly multiplies speed
        snowboarder.vx = game.learningRate * (gravityPull + snowboarder.momentum * 50);
        
        // Add friction to make it realistic
        snowboarder.vx *= 0.95;
        
        // REAL PHYSICS: If going too slow uphill, slide backward!
        if (gradient < -0.1 && snowboarder.vx < 3) {
            snowboarder.vx = gradient * 20; // Slide back (negative speed)
        }
        
        // LAUNCH CONDITIONS: At peaks or sharp upward slopes with speed
        const nextGradient = calculateGradient(snowboarder.x + 10);
        const gradientChange = gradient - nextGradient;
        
        // Launch if: going fast + hitting a peak or ramp
        if ((gradientChange > 0.15 && snowboarder.vx > 5) || 
            (gradient < -0.25 && snowboarder.vx > 8)) {
            // LAUNCH! 
            snowboarder.vy = -Math.abs(gradient * snowboarder.vx * 0.4);
            snowboarder.onGround = false;
        } else {
            snowboarder.y = terrainY - snowboarder.height/2;
            snowboarder.vy = 0;
        }
        
        // Check holes while on ground
        holes.forEach(hole => {
            const dist = Math.abs(snowboarder.x - hole.x);
            if (dist < hole.radius - 5) {
                game.gameOver = true;
            }
        });
    } else {
        // IN THE AIR - proper physics
        snowboarder.vy += game.gravity;
        snowboarder.vx *= 0.98; // Air resistance
        
        // Check for landing
        if (snowboarder.y + snowboarder.height/2 >= terrainY) {
            snowboarder.onGround = true;
            snowboarder.y = terrainY - snowboarder.height/2;
            
            // Lose some momentum on hard landing
            if (snowboarder.vy > 10) {
                snowboarder.momentum *= 0.5;
            }
        }
    }
    
    // Update position
    snowboarder.x += snowboarder.vx;
    snowboarder.y += snowboarder.vy;
    
    // Hole collision
    holes.forEach(hole => {
        const holeY = terrainFunction(hole.x) + 15;
        const dist = Math.sqrt(
            Math.pow(snowboarder.x - hole.x, 2) + 
            Math.pow(snowboarder.y - holeY, 2)
        );
        
        if (dist < hole.radius - 5) {
            game.gameOver = true;
        }
    });
    
    // Trail
    snowboarder.trail.push({x: snowboarder.x, y: snowboarder.y});
    if (snowboarder.trail.length > 100) snowboarder.trail.shift();
    
    // Check boundaries
    if (snowboarder.x < 0 || snowboarder.x > game.width || snowboarder.y > game.height) {
        game.gameOver = true;
    }
    
    // Check lodge
    if (Math.abs(snowboarder.x - lodge.x) < 30 && 
        Math.abs(snowboarder.y - lodge.y) < 50) {
        game.won = true;
        game.score += 1000;
    }
    
    // Score
    game.score += Math.max(snowboarder.vx * 0.1, 0);
    
    updateUI();
} 

// // PROPER PHYSICS update function
// function updateSnowboarder() {
//     if (game.gameOver || game.won) return;
    
//     const terrainY = terrainFunction(snowboarder.x);
//     const gradient = calculateGradient(snowboarder.x);
    
//     // If on ground
//     if (snowboarder.onGround) {
//         // Build momentum on downhills
//         if (gradient > 0.05) {
//             snowboarder.momentum = Math.min(snowboarder.momentum + 0.1, 2);
//         } else if (gradient < -0.05) {
//             snowboarder.momentum = Math.max(snowboarder.momentum - 0.1, 0);
//         }
        
//         // Calculate forces
//         const gravityForce = gradient * 50; // Gravity pulls down slopes
//         const frictionForce = -snowboarder.vx * 0.05; // Friction slows you down
//         const propulsionForce = game.learningRate * 100 * gradient; // Learning rate amplifies gradient
        
//         // Apply forces
//         snowboarder.vx += (gravityForce + frictionForce + propulsionForce) * game.learningRate;
        
//         // Add momentum boost
//         snowboarder.vx += snowboarder.momentum * game.learningRate * 10;
        
//         // REAL PHYSICS: If going too slow uphill, slide backward!
//         if (gradient < -0.1 && snowboarder.vx < 2) {
//             snowboarder.vx -= 0.5; // Slide back down!
//         }
        
//         // LAUNCH CONDITIONS: At peaks or sharp upward slopes with speed
//         const nextGradient = calculateGradient(snowboarder.x + 10);
//         const gradientChange = gradient - nextGradient;
        
//         // Launch if: going fast + hitting a peak or ramp
//         if ((gradientChange > 0.15 && snowboarder.vx > 5) || 
//             (gradient < -0.25 && snowboarder.vx > 8)) {
//             // LAUNCH! 
//             snowboarder.vy = -Math.abs(gradient * snowboarder.vx * 0.4);
//             snowboarder.onGround = false;
//         } else {
//             snowboarder.y = terrainY - snowboarder.height/2;
//             snowboarder.vy = 0;
//         }
        
//         // Check holes while on ground
//         holes.forEach(hole => {
//             const dist = Math.abs(snowboarder.x - hole.x);
//             if (dist < hole.radius - 5) {
//                 game.gameOver = true;
//             }
//         });
//     } else {
//         // IN THE AIR - proper physics
//         snowboarder.vy += game.gravity;
//         snowboarder.vx *= 0.98; // Air resistance
        
//         // Check for landing
//         if (snowboarder.y + snowboarder.height/2 >= terrainY) {
//             snowboarder.onGround = true;
//             snowboarder.y = terrainY - snowboarder.height/2;
            
//             // Lose some momentum on hard landing
//             if (snowboarder.vy > 10) {
//                 snowboarder.momentum *= 0.5;
//             }
//         }
//     }
    
//     // Update position
//     snowboarder.x += snowboarder.vx;
//     snowboarder.y += snowboarder.vy;
    
//     // Hole collision
//     holes.forEach(hole => {
//         const holeY = terrainFunction(hole.x) + 15;
//         const dist = Math.sqrt(
//             Math.pow(snowboarder.x - hole.x, 2) + 
//             Math.pow(snowboarder.y - holeY, 2)
//         );
        
//         if (dist < hole.radius - 5) {
//             game.gameOver = true;
//         }
//     });
    
//     // Trail
//     snowboarder.trail.push({x: snowboarder.x, y: snowboarder.y});
//     if (snowboarder.trail.length > 100) snowboarder.trail.shift();
    
//     // Check boundaries
//     if (snowboarder.x < 0 || snowboarder.x > game.width || snowboarder.y > game.height) {
//         game.gameOver = true;
//     }
    
//     // Check lodge
//     if (Math.abs(snowboarder.x - lodge.x) < 30 && 
//         Math.abs(snowboarder.y - lodge.y) < 50) {
//         game.won = true;
//         game.score += 1000;
//     }
    
//     // Score
//     game.score += Math.max(snowboarder.vx * 0.1, 0);
    
//     updateUI();
// }

function updateUI() {
    const status = snowboarder.onGround ? "🎿" : "✈️";
    document.getElementById('speed').textContent = 
        Math.abs(snowboarder.vx).toFixed(2) + " " + status;
    document.getElementById('score').textContent = 
        Math.floor(game.score);
    document.getElementById('lrValue').textContent = 
        game.learningRate.toFixed(2);
}

// Handle learning rate changes
document.getElementById('learningRate').addEventListener('input', (e) => {
    game.learningRate = parseFloat(e.target.value);
});

// Reset game
function resetGame() {
    snowboarder.x = 50;
    snowboarder.y = 50;
    snowboarder.vx = 0;
    snowboarder.vy = 0;
    snowboarder.onGround = true;
    snowboarder.momentum = 0;
    snowboarder.trail = [];
    game.score = 0;
    game.gameOver = false;
    game.won = false;
}

// Game loop
function gameLoop() {
    ctx.clearRect(0, 0, game.width, game.height);
    
    drawTerrain();
    drawLodge();
    drawSnowboarder();
    updateSnowboarder();
    
    if (game.gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, game.width, game.height);
        ctx.fillStyle = 'white';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('💥 Crashed! Press Reset', game.width/2, game.height/2);
    }
    
    if (game.won) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.fillRect(0, 0, game.width, game.height);
        ctx.fillStyle = 'white';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🎉 You reached the lodge!', game.width/2, game.height/2);
    }
    
    requestAnimationFrame(gameLoop);
}

// Start
snowboarder.image.onload = () => {
    gameLoop();
};
gameLoop();