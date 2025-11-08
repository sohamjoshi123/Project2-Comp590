console.clear();

// ----------------------------------------------
// Axis data (do not modify)
// ----------------------------------------------

let A = [
    [0.0, 0.0, 0.0],
    [1.0, 0.0, 0.0],
    [0.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
    [0.0, 0.0, 0.0],
    [0.0, 0.0, 1.0]
];

// ----------------------------------------------
// end axis data
// ----------------------------------------------

// ----------------------------------------------
// Simuation control (do not modify)
// ----------------------------------------------

let xang = 0;
let yang = 0;
let zang = 0;
let rot = 0;
let axisRotation = null;
let rot_inc = 10;

function startRotation(rotationFunc) {
    if (axisRotation !== null) clearInterval(axisRotation);
    axisRotation = setInterval(rotationFunc, 100);
}

function stopRotation() {
    clearInterval(axisRotation);
    axisRotation = null;
}

document.addEventListener('mouseup', stopRotation);

document.addEventListener('mousedown', function (event) {
    switch ( event.target.id ) {
        case "pitch-up":
            startRotation(() => { xang = ( xang + rot_inc ) % 360; });
            break;
        case "pitch-down":
            startRotation(() => { xang = ( xang - rot_inc ) % 360; });
            break;
        case "roll-left":
            startRotation(() => { zang = ( zang + rot_inc ) % 360; });
            break;
        case "roll-right":
            startRotation(() => { zang = ( zang - rot_inc ) % 360; });
            break;
        case "yaw-left":
            startRotation(() => { yang = ( yang + rot_inc ) % 360; });
            break;
        case "yaw-right":
            startRotation(() => { yang = ( yang - rot_inc ) % 360; });
            break;
        case "reset":
            xang = yang = zang = 0; 
            break;
        default:
            stopRotation();
    }
});

// ----------------------------------------------
// End simuation control
// ----------------------------------------------

const RADIANS = Math.PI / 180;
const MODEL_SCALE = 1.75;
const PROPELLER_OFFSET = -0.65;

let viewContexts = new Map();
let meshData = [];
let axisStartIndex = 0;
let planeTriangleCount = 0;
let propStartIndex = 0;
let propRotationAngle = 0;

function buildMeshGeometry() {
    let triangleList = [];
    
    Fpl.forEach(face => {
        triangleList.push(Vpl[face[0]]);
        triangleList.push(Vpl[face[1]]);
        triangleList.push(Vpl[face[2]]);
    });
    
    planeTriangleCount = triangleList.length;
    propStartIndex = triangleList.length;
    
    Fpp.forEach(face => {
        triangleList.push(Vpp[face[0]]);
        triangleList.push(Vpp[face[1]]);
        triangleList.push(Vpp[face[2]]);
    });
    
    axisStartIndex = triangleList.length;
    A.forEach(point => triangleList.push(point));
    
    meshData = triangleList;
}

function initializeViewports() {
    const viewIds = ["xyz", "xz", "yz", "xy"];
    
    viewIds.forEach(viewId => {
        const canvasElement = document.getElementById(viewId);
        const glContext = canvasElement.getContext("webgl");
        const shaderProgram = initShaders(glContext, "vertex-shader", "fragment-shader");
        
        glContext.useProgram(shaderProgram);
        glContext.viewport(0, 0, canvasElement.width, canvasElement.height);
        glContext.enable(glContext.DEPTH_TEST);
        
        viewContexts.set(viewId, {
            context: glContext,
            program: shaderProgram,
            vertexLocation: glContext.getAttribLocation(shaderProgram, "vertex"),
            propsLocation: glContext.getUniformLocation(shaderProgram, "props"),
            colorLocation: glContext.getUniformLocation(shaderProgram, "color"),
            zTranslateLocation: glContext.getUniformLocation(shaderProgram, "z_translation")
        });
    });
}

function uploadGeometryToGPU() {
    viewContexts.forEach(viewData => {
        const gl = viewData.context;
        const geometryBuffer = gl.createBuffer();
        
        gl.bindBuffer(gl.ARRAY_BUFFER, geometryBuffer);
        gl.vertexAttribPointer(viewData.vertexLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(viewData.vertexLocation);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(meshData), gl.STATIC_DRAW);
    });
}

function renderAircraft(viewData, pitchAngle, yawAngle, rollAngle) {
    const gl = viewData.context;
    
    gl.uniform1f(viewData.zTranslateLocation, 0);
    gl.uniform4f(viewData.propsLocation, 
        pitchAngle * RADIANS,
        yawAngle * RADIANS, 
        rollAngle * RADIANS, 
        MODEL_SCALE);
    
    gl.uniform4f(viewData.colorLocation, 0.5, 0.5, 0.5, 1);
    for (let i = 0; i < planeTriangleCount; i += 3) {
        gl.drawArrays(gl.LINE_STRIP, i, 3);
    }
    
    gl.uniform1f(viewData.zTranslateLocation, PROPELLER_OFFSET);
    gl.uniform4f(viewData.propsLocation,
        pitchAngle * RADIANS,
        yawAngle * RADIANS,
        (rollAngle + propRotationAngle) * RADIANS,
        MODEL_SCALE);
    
    let propTriangleCount = axisStartIndex - propStartIndex;
    for (let i = propStartIndex; i < axisStartIndex; i += 3) {
        gl.drawArrays(gl.LINE_STRIP, i, 3);
    }
    
    gl.uniform4f(viewData.colorLocation, 0.81, 0.81, 0.81, 1.0);
    gl.drawArrays(gl.TRIANGLES, propStartIndex, propTriangleCount);
    
    gl.uniform1f(viewData.zTranslateLocation, 0);
    gl.uniform4f(viewData.propsLocation,
        pitchAngle * RADIANS,
        yawAngle * RADIANS,
        rollAngle * RADIANS,
        MODEL_SCALE);
    
    gl.drawArrays(gl.TRIANGLES, 0, planeTriangleCount);
    
    propRotationAngle = (propRotationAngle + rot_inc) % 360;
}

function renderCoordinateAxes(viewData, pitchAngle, yawAngle, rollAngle) {
    const gl = viewData.context;
    
    gl.uniform4f(viewData.propsLocation,
        pitchAngle * RADIANS,
        yawAngle * RADIANS,
        rollAngle * RADIANS,
        MODEL_SCALE);
    
    gl.uniform4f(viewData.colorLocation, 1.0, 0.0, 0.0, 1.0);
    gl.drawArrays(gl.LINES, axisStartIndex, 2);
    
    gl.uniform4f(viewData.colorLocation, 0.0, 1.0, 0.0, 1.0);
    gl.drawArrays(gl.LINES, axisStartIndex + 2, 2);
    
    gl.uniform4f(viewData.colorLocation, 0.0, 0.0, 1.0, 1.0);
    gl.drawArrays(gl.LINES, axisStartIndex + 4, 2);
}

function renderMainView() {
    const mainView = viewContexts.get("xyz");
    mainView.context.clear(mainView.context.COLOR_BUFFER_BIT | mainView.context.DEPTH_BUFFER_BIT);
    renderAircraft(mainView, xang, yang, zang);
    renderCoordinateAxes(mainView, xang, yang, zang);
}

function renderTopView() {
    const topView = viewContexts.get("xz");
    topView.context.clear(topView.context.COLOR_BUFFER_BIT | topView.context.DEPTH_BUFFER_BIT);
    renderAircraft(topView, -90, yang, 0);
    renderCoordinateAxes(topView, -90, yang, 0);
}

function renderSideView() {
    const sideView = viewContexts.get("yz");
    sideView.context.clear(sideView.context.COLOR_BUFFER_BIT | sideView.context.DEPTH_BUFFER_BIT);
    renderAircraft(sideView, xang, 0, 0);
    renderCoordinateAxes(sideView, xang, 0, 0);
}

function renderFrontView() {
    const frontView = viewContexts.get("xy");
    frontView.context.clear(frontView.context.COLOR_BUFFER_BIT | frontView.context.DEPTH_BUFFER_BIT);
    renderAircraft(frontView, 0, -90, zang);
    renderCoordinateAxes(frontView, 0, -90, zang);
}

function updateAllViews() {
    renderMainView();
    renderTopView();
    renderSideView();
    renderFrontView();
}

buildMeshGeometry();
initializeViewports();
uploadGeometryToGPU();
setInterval(updateAllViews, 100);




























