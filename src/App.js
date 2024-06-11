
import './App.css';
import {PoseLandmarker, FilesetResolver, DrawingUtils} from "@mediapipe/tasks-vision";

function App() {
    let enableWebcamButton: HTMLButtonElement;
    let webcamRunning = false

    const createPoseLandmarker = async () =>{
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const poseLandmarker = await PoseLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO"
            });

        const video = document.getElementById("webcam");
        const canvasElement = document.getElementById("output_canvas");
        const canvasCtx = canvasElement.getContext("2d");
        const drawingUtils = new DrawingUtils(canvasCtx);

        // Check if webcam access is supported.
        const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

        // If webcam supported, add event listener to button for when user
        // wants to activate it.

        if (hasGetUserMedia()) {
            enableWebcamButton = document.getElementById("webcamButton");
            enableWebcamButton.addEventListener("click", enableCam);
        } else {
            console.warn("getUserMedia() is not supported by your browser");
        }

        function enableCam() {
            if (!poseLandmarker) {
                console.log("Wait! poseLandmaker not loaded yet.");
                return;
            }
            if (webcamRunning === true) {
                webcamRunning = false;
                enableWebcamButton.innerText = "ENABLE PREDICTIONS";
            } else {
                webcamRunning = true;
                enableWebcamButton.innerText = "DISABLE PREDICTIONS";
            }
            // getUsermedia parameters.
            const constraints = {
                video: true
            };


            // Activate the webcam stream.
            navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
                video.srcObject = stream;
                video.addEventListener("loadeddata", predictWebcam);
            });
        }

        function calcDistance(p1, p2){
            return(Math.sqrt(((p2.x - p1.x) ** 2) + ((p2.y - p1.y) ** 2) ))
        }
        function calcMidpoint(p1, p2){
            return({x:(p1.x + p2.x)/2, y:(p1.y + p2.y)/2, z:(p1.z + p2.z)/2})
        }


        let lastVideoTime = -1;
        let lIndex
        let rIndex
        let lShoulder
        let rShoulder
        let centerIndex
        let centerMouth
        let centerHip
        let centerEyeInner
        let goLower = false
        let counter = 0
        let toLeftSide = false
        let torsoDiameter

        let fpsArray = []
        let end
        let totalTime

        const radioButtons = document.querySelectorAll('input[type="radio"]');
        let selectedExercise

        function toMouthUp(rMouth, lMouth, rIndex, lIndex){
            centerMouth = calcMidpoint(rMouth, lMouth)
            centerIndex = calcMidpoint(rIndex, lIndex)
            document.getElementById("message").innerHTML = "Поднимите руки до уровня рта";
            if (calcDistance(centerIndex, centerMouth) <= torsoDiameter * 0.1) {
                goLower = true
            }
        }

        function toForeheadUp(rEyeInner, lEyeInner, rIndex, lIndex, rEar, lEar){
            centerEyeInner = calcMidpoint(rEyeInner, lEyeInner)
            centerIndex = calcMidpoint(rIndex, lIndex)
            document.getElementById("message").innerHTML = "Поднимите руки до уровня лба";
            if ((centerIndex.y < centerEyeInner.y) && (centerIndex.x >= lEar.x && centerIndex.x <= rEar.x)){
                goLower = true
            }
        }


        function toEarUp(lEar, rEar, rThumb, lThumb){
            if (toLeftSide){
                document.getElementById("message").innerHTML = "Поднимите руки до левого уха";
                console.log((calcDistance(lEar, rThumb)))
                if ((calcDistance(lEar, rThumb) <= torsoDiameter * 0.15)){
                    if (counter % 5 === 4)
                        toLeftSide = false
                    goLower = true
                }
            }
            else{
                document.getElementById("message").innerText = "Поднимите руки до правого уха";
                console.log((calcDistance(rEar, lThumb)))
                if ((calcDistance(rEar, lThumb) <= torsoDiameter * 0.15)){
                    if (counter % 5 === 4 && counter > 0)
                        toLeftSide = true
                    goLower = true
                }
            }
        }

        function toDown(rHip, lHip, rIndex, lIndex){
            document.getElementById("message").innerHTML = "Опустите руки";
            centerIndex = calcMidpoint(rIndex, lIndex)
            centerHip = calcMidpoint(rHip, lHip)
            if (calcDistance(centerIndex, centerHip) <= torsoDiameter * 0.15){
                goLower = false
                counter += 1
                document.getElementById("counter").innerHTML = "Количество повторений: " + counter;
            }
        }

        async function predictWebcam() {
            canvasElement.style.height = "480px";
            video.style.height = "480px";
            canvasElement.style.width = "640px";
            video.style.width = "640px";

            for (let i = 0; i < radioButtons.length; i++) {
                if (radioButtons[i].checked) {
                    selectedExercise = radioButtons[i].value
                }
            }
            radioButtons.forEach(radioButton => {
                radioButton.addEventListener('change', () => {
                    counter = 0;
                    document.getElementById("counter").innerHTML = "";
                });
            });
            let startTimeMs = performance.now();
            if (lastVideoTime !== video.currentTime) {
                lastVideoTime = video.currentTime;
                poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
                    canvasCtx.save();
                    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
                    for (const landmark of result.landmarks) {
                        if (selectedExercise){
                            torsoDiameter = calcDistance(landmark[11], landmark[24])
                            rIndex = landmark[19]
                            lIndex = landmark[20]
                            if (calcDistance(rIndex, lIndex) > torsoDiameter * 0.2) {
                                //console.log('Соедините руки в замок')
                                document.getElementById("message").innerHTML = "Соедините руки в замок";
                            } else {
                                rShoulder = landmark[11]
                                lShoulder = landmark[12]
                                if (Math.abs(rShoulder.y - lShoulder.y) > torsoDiameter * 0.07){
                                    document.getElementById("message").innerHTML = "Старайтесь держать плечи ровно";
                                }
                                else{
                                    if (!goLower){
                                        switch (selectedExercise) {
                                            case 'mouth':
                                                toMouthUp(landmark[9], landmark[10], rIndex, lIndex)
                                                break;
                                            case 'forehead':
                                                toForeheadUp(landmark[1], landmark[4], rIndex, lIndex, landmark[7], landmark[8], landmark[13], landmark[14])
                                                break;
                                            case 'ears':
                                                toEarUp(landmark[7], landmark[8], landmark[21], landmark[22], landmark[13], landmark[14], rShoulder, landmark[23])
                                                break;
                                            default:
                                        }
                                    }
                                    else {
                                        toDown(landmark[23], landmark[24], rIndex, lIndex)
                                    }
                                }
                            }
                        }

                        drawingUtils.drawLandmarks(landmark, {
                            radius: (data) => DrawingUtils.lerp(data.from?.z ?? 0.0, -0.15, 0.1, 5, 1)
                        });
                        drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
                    }
                    canvasCtx.restore();

                });
            }
            if (webcamRunning === true) {
                end = performance.now();
                totalTime = (end - startTimeMs) / 1000;
                if (1/totalTime !== Infinity)   //Better to remove later
                    fpsArray.push(1/totalTime)
                let fpsArraySum = 0
                if (fpsArray.length === 100){
                    fpsArraySum = fpsArray.reduce((acc, num) => acc + num, 0)
                    document.getElementById("fpsCounter").innerHTML = "FPS: " + Math.round(fpsArraySum/100);
                    fpsArray = []
                }
                window.requestAnimationFrame(predictWebcam);
            }
        }
    }

    createPoseLandmarker();



    return (
        <div className="App">
            <div id="liveView" className="videoView" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                margin: '5% auto',
                width: '640px',
                gap:'1rem'
            }}>
                <button id="webcamButton" className="mdc-button mdc-button--raised">
                    <span className="mdc-button__ripple"/>
                    <span className="mdc-button__label">ENABLE WEBCAM</span>
                </button>
                <fieldset>
                    <legend>Поднятие замка рук до:</legend>
                    <div id='exerciseSelection'>
                        <input type="radio" id="radioMouth" value="mouth" name="exercise"/>
                        <label>Рта</label>
                        <input type="radio" id="radioForehead" value="forehead" name="exercise"/>
                        <label>Лба</label>
                        <input type="radio" id="radioEars" value="ears" name="exercise" />
                        <label>Ушей</label>
                    </div>
                </fieldset>
                <div id='fpsCounter'>FPS: </div>
                <div style={{width:"640px", height:"480px", position:"relative"}}>
                    <video id="webcam" width='640px' height='480px' style={{position: 'absolute', top:'0', left:'0'}} autoPlay playsInline/>
                    <canvas className="output_canvas" id="output_canvas" width='640px' height='480px' style={{position: 'absolute', top:'0', left:'0'}}/>
                </div>
                <div id="stats" >
                    <div id="message" style={{fontSize: "30px"}}></div>
                    <div id="counter" style={{fontSize: "30px"}}></div>
                </div>
            </div>
        </div>
    );
}

export default App;