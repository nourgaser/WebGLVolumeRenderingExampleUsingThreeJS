//Parameters that can be modified.
var controls = new (function () {
  this.model = "bonsai";
  this.steps = 50;
  this.alphaCorrection = 1.0;
  this.color1 = "#00FA58";
  this.stepPos1 = 0.1;
  this.color2 = "#CC6600";
  this.stepPos2 = 0.7;
  this.color3 = "#F2F200";
  this.stepPos3 = 1.0;
})();

function init(materialSecondPass, updateTextures, cubeTextures) {
  var gui = new dat.GUI();
  var modelSelected = gui.add(controls, "model", [
    "bonsai",
    "foot",
    "teapot",
  ]);
  gui.add(controls, "steps", 0.0, 100.0);
  gui.add(controls, "alphaCorrection", 0.01, 5.0).step(0.01);

  modelSelected.onChange(function (value) {
    materialSecondPass.uniforms.cubeTex.value = cubeTextures[value];
  });

  //Setup transfer function steps.
  var step1Folder = gui.addFolder("Step 1");
  var controllerColor1 = step1Folder.addColor(controls, "color1");
  var controllerStepPos1 = step1Folder.add(controls, "stepPos1", 0.0, 1.0);
  controllerColor1.onChange(updateTextures);
  controllerStepPos1.onChange(updateTextures);

  var step2Folder = gui.addFolder("Step 2");
  var controllerColor2 = step2Folder.addColor(controls, "color2");
  var controllerStepPos2 = step2Folder.add(controls, "stepPos2", 0.0, 1.0);
  controllerColor2.onChange(updateTextures);
  controllerStepPos2.onChange(updateTextures);

  var step3Folder = gui.addFolder("Step 3");
  var controllerColor3 = step3Folder.addColor(controls, "color3");
  var controllerStepPos3 = step3Folder.add(controls, "stepPos3", 0.0, 1.0);
  controllerColor3.onChange(updateTextures);
  controllerStepPos3.onChange(updateTextures);

  step1Folder.open();
  step2Folder.open();
  step3Folder.open();
}

export default { controls, init };
