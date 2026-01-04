# WebGL Volume Rendering Guide

This document explains how the project renders a 3D volume from 2D slice atlases in the browser using Three.js. It covers the rendering pipeline, shaders, controls, data formats, and alternative approaches you could take. You only need a basic sense of what volume rendering is; everything else is expanded below.

## What the app does

- Loads a 2D texture atlas of CT slices (bonsai, foot, teapot) and ray-marches through it to render the volume.
- Uses a two-pass technique: the first pass encodes back-face positions of the cube into a render target; the second pass uses those positions to know where each view ray exits the volume.
- Lets you tweak sampling density, opacity correction, and a 3-stop transfer function via dat.GUI, with a live preview.

Key entry points: [web/index.html](web/index.html), [web/js/main.js](web/js/main.js), [web/js/gui.js](web/js/gui.js), [web/shaders](web/shaders).

## Runtime flow

1) **Bootstrapping** (HTML): [web/index.html](web/index.html) loads Three.js, Detector (feature check), Stats, OrbitControls, dat.GUI, then the ES module [web/js/main.js](web/js/main.js). It also places a container div and an image to show the current transfer function.

2) **Initialization** ([web/js/main.js](web/js/main.js)):
   - Creates a perspective camera and orbit controls targeting the origin.
   - Loads three 2D atlas textures (bonsai, foot, teapot) with mipmaps disabled and linear filtering to avoid LOD artifacts.
   - Builds a float RGBA render target `rtTexture` sized to the viewport with nearest filtering to avoid interpolating back-face positions at cube edges.
   - Loads four shader sources from [web/shaders](web/shaders) using the small fetch helper [web/js/loadShader.js](web/js/loadShader.js).
   - Creates two `THREE.ShaderMaterial` instances: first pass on `BackSide`, second pass on `FrontSide`, each with uniforms for box dimensions and relevant textures.
   - Builds two scenes, each containing a unit cube mesh (one per pass), and starts the render loop with `requestAnimationFrame`.

3) **GUI setup** ([web/js/gui.js](web/js/gui.js)):
   - dat.GUI exposes `model`, `steps`, `alphaCorrection`, and three color/position stops for the transfer function.
   - Changing the model swaps the atlas texture used by the second pass; changing transfer stops regenerates the transfer texture on a canvas and updates the preview image.

4) **Per-frame work** ([web/js/main.js](web/js/main.js)):
   - First pass: render the back faces of the cube into `rtTexture`, storing world-space positions in RGBA.
   - Second pass: render the front faces with the ray-marching shader, using `rtTexture` to fetch exit points for each pixel’s ray and sampling the 3D data.
   - Update uniforms for `steps` and `alphaCorrection` from GUI controls; update Stats overlay.

5) **Resize**: recomputes camera aspect and renderer size to match the window.

## Data representation

- **Volume as atlas**: A 256-slice volume is packed into a 16×16 tile grid in a single 2D texture (opacity in the alpha channel). `slicesPerSide = 16`, so slice index maps into tile row/column. This emulates a 3D texture where WebGL1 lacks native 3D textures.
- **Box normalization**: The cube is treated as `[0, boxSize]` in world space; here boxSize is `[1,1,1]`, but the code is ready for non-cubic volumes by scaling positions in shaders.
- **Transfer function**: Built on an offscreen canvas from three user-defined color stops, then uploaded as a 1D texture. Alpha comes from the volume data; RGB comes from looking up that alpha in the transfer texture. A tiny image on the page shows the current gradient.

## Shaders, pass-by-pass

### First pass (back faces)
- Files: [web/shaders/vertexShaderFirstPass.glsl](web/shaders/vertexShaderFirstPass.glsl), [web/shaders/fragmentShaderFirstPass.glsl](web/shaders/fragmentShaderFirstPass.glsl).
- Vertex shader outputs world-space coordinates of each vertex (shifted from `[-0.5,0.5]` to `[0,1]` using box dimensions) via `worldSpaceCoords`.
- Fragment shader writes those coordinates as RGBA into the render target. Only back faces are rendered, so every screen pixel that hits the cube stores where the ray will exit the volume.

### Second pass (front faces, ray marching)
- Files: [web/shaders/vertexShaderSecondPass.glsl](web/shaders/vertexShaderSecondPass.glsl), [web/shaders/fragmentShaderSecondPass.glsl](web/shaders/fragmentShaderSecondPass.glsl).
- Vertex shader outputs two varyings: `worldSpaceCoords` (front-face world position) and `projectedCoords` (clip-space position for reconstructing screen UVs).
- Fragment shader steps:
  1) Reconstruct screen UV from `projectedCoords` and fetch `backPos` from `rtTexture` at that UV.
  2) If no valid `backPos` (edge cases), discard to transparent.
  3) Compute ray direction `dir = backPos - frontPos` and length.
  4) March in `steps` increments; at each step sample the atlas as a 3D texture and accumulate color/alpha using front-to-back compositing. Early-exit when fully opaque or past the exit point.
  5) Write the accumulated color.
- Sampling helper `sampleAs3DTexture` does 3D trilinear sampling over the 2D atlas: map x/y into [0,1], pick two adjacent z slices, bilinearly sample both, look up RGB via the transfer function using the sampled alpha, then mix by z fraction.
- `alphaCorrection` and `alphaScaleFactor` tune opacity so visual density stays reasonable as you change step counts.

## Core concepts in play

- **Two-pass front/back capture**: Rendering back faces to a texture gives an accurate exit position per pixel, avoiding guessing ray length in the shader and handling arbitrary view directions.
- **Ray marching**: Integrates color/opacity along the ray inside the volume. Front-to-back compositing allows early termination when opacity saturates.
- **Transfer function**: Maps scalar voxel intensities to colors; here alpha comes from the data, RGB from a user-editable 1D texture.
- **Atlas-based 3D sampling**: Emulates a 3D texture in WebGL1 by tiling slices; requires manual addressing logic in the shader.
- **Filtering choices**: Nearest filtering on the back-face render target avoids interpolated exit positions; linear filtering on the volume atlas smooths slice sampling; mipmaps are off to avoid cross-slice artifacts.

## How to run and tweak

- Serve the `web` folder over HTTP (e.g., `npx http-server web`) and open in a WebGL-capable browser.
- Use the GUI to switch models, increase `steps` for higher quality (more samples, slower), and adjust `alphaCorrection` to keep opacity consistent.
- Drag the three color stops or move their positions to reshape the transfer function; watch the preview image update.

## Extending or modifying

- **Add a new dataset**: Pack 256 slices into a 16×16 atlas PNG, place it in `textures`, add its name to `cubeTextures` in [web/js/main.js](web/js/main.js), and to the GUI `model` list in [web/js/gui.js](web/js/gui.js). If your volume is not cubic, set `boxWidth/Height/Depth` and ensure your slice aspect matches.
- **Change volume dimensions**: Adjust `boxSize` in [web/js/main.js](web/js/main.js) and keep the shader scaling (already uses these uniforms). If using non-256 slice counts, update `slicesPerSide` and `zDepth` in [web/shaders/fragmentShaderSecondPass.glsl](web/shaders/fragmentShaderSecondPass.glsl) and ensure your atlas layout matches.
- **Tune quality/performance**: Lower `steps` to speed up; consider jittered sampling to reduce banding; add a maximum opacity cap for earlier exits.
- **Add lighting**: Compute gradients via central differences in `sampleAs3DTexture` to get normals and apply a simple Phong model; this adds three more texture fetches per step, so reduce `steps` accordingly.
- **Add max-intensity projection (MIP)**: Replace front-to-back compositing with `max(colorSample.a)` accumulation and output the transfer-colored sample with highest intensity.
- **Add clipping planes**: Clip the ray marching range by intersecting with user-defined planes; adjust `frontPos/backPos` before marching.

## Alternative implementation paths

1) **Single-pass ray marching with depth buffer**: Render only front faces, reconstruct exit points by sampling the depth buffer and converting to world space. Needs depth texture support and extra math to convert depth to world coordinates; avoids the back-face render target but depends on precise depth reconstruction.
2) **WebGL2 3D textures**: If targeting WebGL2, store the volume in a native 3D texture and replace the atlas logic with `texture(volume3D, texCoord)`. Simplifies `sampleAs3DTexture`, removes tiling math, but requires WebGL2 availability and 3D texture uploads.
3) **Compute via WebGPU or fragment shader atlas preload**: With WebGPU or a compute-like path, you could precompute gradients, empty-space skipping structures, or bricked data. Requires a different API and pipeline setup but yields better performance and richer effects (bricking, empty-space leaping, adaptive step sizes).
4) **Proxy geometry slicing**: Instead of ray marching per pixel, render many view-aligned slices of the volume proxy cube, each sampling the volume texture. Simpler shader and compatible with older hardware, but more draw calls and less adaptive sampling along rays.
5) **Pre-integrated transfer functions**: Precompute a 2D LUT of integrated color/alpha for pairs of samples to reduce banding at low step counts. Requires modifying the shader to fetch from the LUT and changing the transfer-function generation to build that LUT.

## Practical tips and gotchas

- Keep `NearestFilter` on the back-face render target; interpolation there causes bogus ray directions near cube edges.
- Match atlas layout, `slicesPerSide`, and `zDepth`; mismatches produce scrambled sampling.
- Alpha scaling: if you raise `steps`, also raise `alphaCorrection` or rely on the built-in `alphaScaleFactor` to keep brightness stable.
- Performance scales with `steps × screenPixels`; full-screen on a 4K display with high steps can be expensive.

With this map of the pipeline, shaders, and data flow, you should be able to read through the linked files and understand every moving part of the renderer, plus how to adapt it to different datasets or rendering styles.
