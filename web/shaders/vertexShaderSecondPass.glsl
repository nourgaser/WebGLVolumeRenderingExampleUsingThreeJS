varying vec3 worldSpaceCoords;
varying vec4 projectedCoords;

uniform float boxWidth;
uniform float boxHeight;
uniform float boxDepth;

void main() {
    worldSpaceCoords = (modelMatrix * vec4(position + vec3(boxWidth / 2.0, boxHeight / 2.0, boxDepth / 2.0), 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    projectedCoords = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}