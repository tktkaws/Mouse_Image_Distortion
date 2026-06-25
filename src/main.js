import * as THREE from "three";
import { projects } from "./data.js";
import { fragmentShader, vertexShader } from "./shaders.js";

const stage = document.querySelector("#webgl-stage");
const projectList = document.querySelector("#project-list");
const projectItemTemplate = document.querySelector("#project-item-template");

const mouse = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
};

const smoothMouse = {
  x: mouse.x,
  y: mouse.y,
};

let activeProject = null;
let currentTextureIndex = 0;
let viewport;
let fade = {
  from: 0,
  to: 0,
  start: performance.now(),
  duration: 200,
};

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.z = 5;
viewport = getViewport();

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");

const textures = projects.map((project, index) =>
  createPlaceholderTexture(project.title, index),
);

const uniforms = {
  uDelta: { value: new THREE.Vector2(0, 0) },
  uAmplitude: { value: 0.0005 },
  uTexture: { value: textures[0] },
  uAlpha: { value: 0 },
};

const geometry = new THREE.PlaneGeometry(1, 1, 15, 15);
const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms,
  transparent: true,
});
const plane = new THREE.Mesh(geometry, material);
scene.add(plane);
updatePlaneScale();

renderProjectList();
loadTextures();
bindEvents();
animate();

function renderProjectList() {
  projects.forEach((project, index) => {
    const item = projectItemTemplate.content.firstElementChild.cloneNode(true);
    item.addEventListener("mouseenter", () => setActiveProject(index));

    const title = item.querySelector("p");
    title.textContent = project.title;

    projectList.appendChild(item);
  });

  projectList.addEventListener("mouseleave", () => setActiveProject(null));
}

function loadTextures() {
  projects.forEach((project, index) => {
    textureLoader.load(
      project.src,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        textures[index] = texture;

        if (activeProject === index || (activeProject === null && index === 0)) {
          uniforms.uTexture.value = texture;
          currentTextureIndex = index;
          updatePlaneScale();
        }
      },
      undefined,
      () => {
        textures[index] = createPlaceholderTexture(project.title, index);
      },
    );
  });
}

function bindEvents() {
  window.addEventListener("pointermove", (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    viewport = getViewport();
    updatePlaneScale();
  });
}

function setActiveProject(index) {
  activeProject = index;

  if (index === null) {
    startFade(0);
    return;
  }

  currentTextureIndex = index;
  uniforms.uTexture.value = textures[index];
  updatePlaneScale();
  startFade(1);
}

function startFade(target) {
  fade = {
    from: uniforms.uAlpha.value,
    to: target,
    start: performance.now(),
    duration: 200,
  };
}

function animate(now = performance.now()) {
  requestAnimationFrame(animate);

  const previousX = smoothMouse.x;
  const previousY = smoothMouse.y;
  const hasMovement =
    Math.abs(mouse.x - previousX) > 1 || Math.abs(mouse.y - previousY) > 1;

  if (hasMovement) {
    smoothMouse.x = lerp(previousX, mouse.x, 0.1);
    smoothMouse.y = lerp(previousY, mouse.y, 0.1);
    uniforms.uDelta.value.set(mouse.x - previousX, -1 * (mouse.y - previousY));
  } else {
    uniforms.uDelta.value.multiplyScalar(0.92);
  }

  plane.position.x = mapRange(
    smoothMouse.x,
    0,
    window.innerWidth,
    -viewport.width / 2,
    viewport.width / 2,
  );
  plane.position.y = mapRange(
    smoothMouse.y,
    0,
    window.innerHeight,
    viewport.height / 2,
    -viewport.height / 2,
  );

  updateAlpha(now);
  renderer.render(scene, camera);
}

function updateAlpha(now) {
  const elapsed = Math.min((now - fade.start) / fade.duration, 1);
  uniforms.uAlpha.value = lerp(fade.from, fade.to, easeOutCubic(elapsed));
}

function updatePlaneScale() {
  const texture = textures[currentTextureIndex] || textures[0];
  const image = texture.image || {};
  const imageWidth = image.naturalWidth || image.width || 1024;
  const imageHeight = image.naturalHeight || image.height || 768;
  const scale = getAspectScale(imageWidth, imageHeight, 0.225);

  plane.scale.set(scale.x, scale.y, 1);
}

function getAspectScale(width, height, factor) {
  const adaptedHeight = height / width;
  const adaptedWidth = width / height;

  if (adaptedHeight > viewport.height) {
    return {
      x: viewport.width * factor,
      y: viewport.width * adaptedHeight * factor,
    };
  }

  return {
    x: viewport.height * adaptedWidth * factor,
    y: viewport.height * factor,
  };
}

function getViewport() {
  const fov = THREE.MathUtils.degToRad(camera?.fov || 75);
  const height = 2 * Math.tan(fov / 2) * (camera?.position.z || 5);
  const width = height * (window.innerWidth / window.innerHeight);

  return { width, height };
}

function createPlaceholderTexture(title, index) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const hue = (index * 47 + 215) % 360;

  canvas.width = 1024;
  canvas.height = 768;

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, `hsl(${hue}, 70%, 62%)`);
  gradient.addColorStop(1, `hsl(${(hue + 80) % 360}, 70%, 34%)`);

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(255, 255, 255, 0.86)";
  context.font = "700 72px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText(title, canvas.width / 2, canvas.height / 2 - 18);

  context.font = "400 30px Arial, sans-serif";
  context.fillText("Place image in public/images", canvas.width / 2, canvas.height / 2 + 52);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function lerp(start, end, amount) {
  return start * (1 - amount) + end * amount;
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}
