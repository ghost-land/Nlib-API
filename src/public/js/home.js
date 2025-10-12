// Interactive cube rotation with mouse
const cubeScene = document.querySelector('.cube-scene');
const cube = document.querySelector('.cube');

let isDragging = false;
let startX = 0;
let startY = 0;
let currentRotationX = -20;
let currentRotationY = -20;
let isAutoRotating = true;

// Start auto-rotation
cube.classList.add('auto-rotate');

cubeScene.addEventListener('mousedown', (e) => {
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  
  // Stop auto-rotation
  if (isAutoRotating) {
    cube.classList.remove('auto-rotate');
    isAutoRotating = false;
    
    // Get current rotation from computed style
    const transform = window.getComputedStyle(cube).transform;
    if (transform !== 'none') {
      const values = transform.split('(')[1].split(')')[0].split(',');
      const matrix = values.map(v => parseFloat(v));
      
      // Extract rotation angles from matrix (simplified)
      currentRotationY = Math.atan2(matrix[1], matrix[0]) * (180 / Math.PI);
    }
  }
});

cubeScene.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;

  currentRotationY += deltaX * 0.5;
  currentRotationX -= deltaY * 0.5;

  // Limit X rotation to prevent flipping
  currentRotationX = Math.max(-90, Math.min(90, currentRotationX));

  cube.style.transform = `rotateX(${currentRotationX}deg) rotateY(${currentRotationY}deg)`;

  startX = e.clientX;
  startY = e.clientY;
});

document.addEventListener('mouseup', () => {
  isDragging = false;
});

// Touch support for mobile
cubeScene.addEventListener('touchstart', (e) => {
  isDragging = true;
  const touch = e.touches[0];
  startX = touch.clientX;
  startY = touch.clientY;
  
  if (isAutoRotating) {
    cube.classList.remove('auto-rotate');
    isAutoRotating = false;
  }
  e.preventDefault();
});

cubeScene.addEventListener('touchmove', (e) => {
  if (!isDragging) return;

  const touch = e.touches[0];
  const deltaX = touch.clientX - startX;
  const deltaY = touch.clientY - startY;

  currentRotationY += deltaX * 0.5;
  currentRotationX -= deltaY * 0.5;

  currentRotationX = Math.max(-90, Math.min(90, currentRotationX));

  cube.style.transform = `rotateX(${currentRotationX}deg) rotateY(${currentRotationY}deg)`;

  startX = touch.clientX;
  startY = touch.clientY;
  e.preventDefault();
});

cubeScene.addEventListener('touchend', () => {
  isDragging = false;
});

// Double-click to reset rotation
cubeScene.addEventListener('dblclick', () => {
  currentRotationX = -20;
  currentRotationY = -20;
  cube.style.transform = `rotateX(${currentRotationX}deg) rotateY(${currentRotationY}deg)`;
});

