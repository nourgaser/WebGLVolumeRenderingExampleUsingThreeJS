import gui from "./gui.js";
import loadShader from "./loadShader.js";

async function init() {
  if (!Detector.webgl) Detector.addGetWebGLMessage();

  let container, stats;
  let camera, sceneFirstPass, sceneSecondPass, renderer;

  let rtTexture, transferTexture;
  let cubeTextures = ["bonsai", "foot", "teapot"];

  let materialSecondPass;

  container = document.getElementById("container");

  camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    0.01,
    3000.0,
  );
  camera.position.z = 2.0;

  const controls = new THREE.OrbitControls(camera, container);
  controls.target.set(0.0, 0.0, 0.0);

  //Load the 2D texture containing the Z slices.
  cubeTextures["bonsai"] = new THREE.TextureLoader().load(
    "textures/bonsai.png",
  );
  cubeTextures["teapot"] = new THREE.TextureLoader().load(
    "textures/teapot.png",
  );
  cubeTextures["foot"] = new THREE.TextureLoader().load("textures/foot.png");

  //Don't let it generate mipmaps to save memory and apply linear filtering to prevent use of LOD.
  cubeTextures["bonsai"].generateMipmaps = false;
  cubeTextures["bonsai"].minFilter = THREE.LinearFilter;
  cubeTextures["bonsai"].magFilter = THREE.LinearFilter;

  cubeTextures["teapot"].generateMipmaps = false;
  cubeTextures["teapot"].minFilter = THREE.LinearFilter;
  cubeTextures["teapot"].magFilter = THREE.LinearFilter;

  cubeTextures["foot"].generateMipmaps = false;
  cubeTextures["foot"].minFilter = THREE.LinearFilter;
  cubeTextures["foot"].magFilter = THREE.LinearFilter;

  transferTexture = updateTransferFunction();

  var screenSize = new THREE.Vector2(window.innerWidth, window.innerHeight);
  //Use NearestFilter to eliminate interpolation.  At the cube edges, interpolated world coordinates
  //will produce bogus ray directions in the fragment shader, and thus extraneous colors.
  rtTexture = new THREE.WebGLRenderTarget(screenSize.x, screenSize.y, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    generateMipmaps: false,
    stencilBuffer: true,
  });

  // Normalized sizes of the cube's dimensions.
  // Format: [x, y, z] or [width, height, depth]
  // If the input data "cube" has dimensions 50 x 25 x 100, then boxSize should be [0.5, 0.25, 1.0]
  // Hardcoding to [1 ,1, 1] here because all input dataets are cubes.
  const boxSize = [1, 1, 1];

  const SHADERS = {
    vertexShaderFirstPass: await loadShader(
      "shaders/vertexShaderFirstPass.glsl",
    ),
    fragmentShaderFirstPass: await loadShader(
      "shaders/fragmentShaderFirstPass.glsl",
    ),
    vertexShaderSecondPass: await loadShader(
      "shaders/vertexShaderSecondPass.glsl",
    ),
    fragmentShaderSecondPass: await loadShader(
      "shaders/fragmentShaderSecondPass.glsl",
    ),
  };

  var materialFirstPass = new THREE.ShaderMaterial({
    vertexShader: SHADERS.vertexShaderFirstPass,
    fragmentShader: SHADERS.fragmentShaderFirstPass,
    side: THREE.BackSide,
    uniforms: {
      boxWidth: {
        type: "1f",
        value: boxSize[0],
      },
      boxHeight: {
        type: "1f",
        value: boxSize[1],
      },
      boxDepth: {
        type: "1f",
        value: boxSize[2],
      },
    },
  });

  materialSecondPass = new THREE.ShaderMaterial({
    vertexShader: SHADERS.vertexShaderSecondPass,
    fragmentShader: SHADERS.fragmentShaderSecondPass,
    side: THREE.FrontSide,
    uniforms: {
      tex: { type: "t", value: rtTexture.texture },
      cubeTex: { type: "t", value: cubeTextures["bonsai"] },
      transferTex: { type: "t", value: transferTexture },
      steps: { type: "1f", value: gui.controls.steps },
      alphaCorrection: { type: "1f", value: gui.controls.alphaCorrection },
      boxWidth: { type: "1f", value: boxSize[0] },
      boxHeight: { type: "1f", value: boxSize[1] },
      boxDepth: { type: "1f", value: boxSize[2] },
    },
  });
  materialSecondPass.needsUpdate = true;

  sceneFirstPass = new THREE.Scene();
  sceneSecondPass = new THREE.Scene();

  var boxGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
  boxGeometry.doubleSided = true;

  var meshFirstPass = new THREE.Mesh(boxGeometry, materialFirstPass);
  var meshSecondPass = new THREE.Mesh(boxGeometry, materialSecondPass);

  sceneFirstPass.add(meshFirstPass);
  sceneSecondPass.add(meshSecondPass);

  renderer = new THREE.WebGLRenderer();
  container.appendChild(renderer.domElement);

  stats = new Stats();
  stats.domElement.style.position = "absolute";
  stats.domElement.style.top = "0px";
  container.appendChild(stats.domElement);

  gui.init(materialSecondPass, () => updateTextures(materialSecondPass, transferTexture));

  setCameraAspectRatio(camera, renderer);

  window.addEventListener("resize", () => setCameraAspectRatio(camera), false);

  // Start the rendering loop.
  animate(materialSecondPass, renderer, sceneFirstPass, sceneSecondPass, camera, rtTexture, stats);
}

function updateTextures(materialSecondPass, transferTexture) {
  materialSecondPass.uniforms.transferTex.value = updateTransferFunction(transferTexture);
}
function updateTransferFunction(transferTexture) {
  var canvas = document.createElement("canvas");
  canvas.height = 20;
  canvas.width = 256;

  var ctx = canvas.getContext("2d");

  var grd = ctx.createLinearGradient(0, 0, canvas.width - 1, canvas.height - 1);
  grd.addColorStop(gui.controls.stepPos1, gui.controls.color1);
  grd.addColorStop(gui.controls.stepPos2, gui.controls.color2);
  grd.addColorStop(gui.controls.stepPos3, gui.controls.color3);

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width - 1, canvas.height - 1);

  var img = document.getElementById("transferFunctionImg");
  img.src = canvas.toDataURL();
  img.style.width = "256 px";
  img.style.height = "128 px";

  transferTexture = new THREE.Texture(canvas);
  transferTexture.wrapS = transferTexture.wrapT = THREE.ClampToEdgeWrapping;
  transferTexture.needsUpdate = true;

  return transferTexture;
}

function setCameraAspectRatio(camera, renderer) {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(materialSecondPass, renderer, sceneFirstPass, sceneSecondPass, camera, rtTexture, stats) {
  requestAnimationFrame(() => animate(materialSecondPass, renderer, sceneFirstPass, sceneSecondPass, camera, rtTexture, stats));

  render(materialSecondPass, renderer, sceneFirstPass, sceneSecondPass, camera, rtTexture);
  stats.update();
}

function render(materialSecondPass, renderer, sceneFirstPass, sceneSecondPass, camera, rtTexture) {
  //Render first pass and store the world space coords of the back face fragments into the texture.
  renderer.setRenderTarget(rtTexture);
  renderer.render(sceneFirstPass, camera);
  renderer.setRenderTarget(null);

  //Render the second pass and perform the volume rendering.
  renderer.render(sceneSecondPass, camera);

  materialSecondPass.uniforms.steps.value = gui.controls.steps;
  materialSecondPass.uniforms.alphaCorrection.value =
    gui.controls.alphaCorrection;
}

init();

//Leandro R Barbagallo - 2015 - lebarba at gmail.com
