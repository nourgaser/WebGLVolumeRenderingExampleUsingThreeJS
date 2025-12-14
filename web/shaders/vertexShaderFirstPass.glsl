varying vec3 worldSpaceCoords;

uniform float boxWidth;
uniform float boxHeight;
uniform float boxDepth;

void main() {
    //Set the world space coordinates of the back faces vertices as output.
    worldSpaceCoords = position + vec3(boxWidth / 2.0, boxHeight / 2.0, boxDepth / 2.0); //move it from [-0.5;0.5] to [0,1]
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}