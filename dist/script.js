// Copyright 2023 The MediaPipe Authors.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//      http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { GestureRecognizer, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const demosSection = document.getElementById("demos");
let gestureRecognizer;
let runningMode = "IMAGE";
let webcamRunning = true; // Always start with webcamRunning enabled
let text;
const textToTypeElement = document.getElementById("textToType");
text = textToTypeElement.innerText;
let signIndex = 0;

const screenWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
//console.log(screenWidth);
const videoWidth = (Math.round(screenWidth/2.22)) +"px";
const videoHeight = (Math.round(screenWidth/2.96)) + "px";
console.log("W: " + videoWidth + " H: " + videoHeight);

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createGestureRecognizer = async () => {
    try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "../gesture_recognizer-2.task",
                delegate: "GPU"
            },
            runningMode: runningMode
        });
        demosSection.classList.remove("invisible");
        enableWebcam();
    } catch (error) {
        alert("Error loading gestureRecognizer. Please try again.");
        console.error(error);
    }
};

createGestureRecognizer();

/********************************************************************
// Demo 2: Continuously grab image from webcam stream and detect it.
********************************************************************/
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const gestureOutput = document.getElementById("gesture_output");

// Check if webcam access is supported.
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById("loadingOverlay");
    loadingOverlay.style.display = "none";
  }

//highlights the guess
function highlightGuess(str) {
    if (str[6]==="<") {
        return str;
    }
    if (str.length >= 7) {
      return str.substring(0, 6) + '<span class="highlight">' + str[6] + '</span>' + str.substring(7);
    }
    return str;
  }

//highlights the guess
function highlightGuess(str) {
    if (str[6]==="<") {
        return str;
    }
    if (str.length >= 7) {
      return str.substring(0, 6) + '<span class="highlight">' + str[6] + '</span>' + str.substring(7);
    }
    return str;
  }

// Enable the live webcam view and start detection.
function enableWebcam() {
    if (!gestureRecognizer) {
        alert("Please wait for gestureRecognizer to load");
        return;
    }

    // getUsermedia parameters.
    const constraints = {
        video: true
    };

    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;
        video.addEventListener("loadeddata", function() {
            predictWebcam();
            hideLoadingOverlay();
        });
    });
}

let lastVideoTime = -1;
let letterStartTime = -1; // Variable to store the start time when a letter is detected
let currentLetter = ""; // Variable to store the current letter being detected
let results = undefined;
let timerElement = document.getElementById("timer");
let timerInterval;
let timerStartTime = -1;

async function predictWebcam() {
    const webcamElement = document.getElementById("webcam");

    // Now let's start detecting the stream.
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
    }

    let nowInMs = Date.now();

    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        results = gestureRecognizer.recognizeForVideo(video, nowInMs);
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    const drawingUtils = new DrawingUtils(canvasCtx);
    canvasElement.style.height = videoHeight;
    webcamElement.style.height = videoHeight;
    canvasElement.style.width = videoWidth;
    webcamElement.style.width = videoWidth;

    if (results.landmarks) {
        for (const landmarks of results.landmarks) {
            const boundingBox = getBoundingBox(landmarks, canvasElement.width, canvasElement.height);
    
            // Draw white box around the hand
            canvasCtx.strokeStyle = "#F0F0F4";
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
    
            drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
                color: "#F0F0F4",
                lineWidth: 5
            });
            drawingUtils.drawLandmarks(landmarks, {
                color: "#0060df",
                lineWidth: 2
            });
    
            // Get guess and confidence
            const letter = categoryToLetter(results.gestures[0][0].categoryName);
            const categoryScore = parseFloat(results.gestures[0][0].score * 100).toFixed(2);
    
            // Draw guess at the bottom right of the box
            drawText(canvasCtx, letter, boundingBox.x + boundingBox.width - 20, boundingBox.y + boundingBox.height + 15, "#ffffff");
    
            // Draw confidence at the top right of the box
            drawText(canvasCtx, `${categoryScore} %`, boundingBox.x + boundingBox.width - 20, boundingBox.y - 10, "#ffffff");
        }
    }

    canvasCtx.restore();

    gestureOutput.style.visibility = "visible";
    gestureOutput.style.width = videoWidth;

    if (results.gestures.length > 0) {
        gestureOutput.style.visibility = "visible";
        const letter = categoryToLetter(results.gestures[0][0].categoryName);
        // Check if the current letter is detected and start the timer
        if (letter !== currentLetter) {
            currentLetter = letter;
            letterStartTime = nowInMs;
        }

        // Check if the current letter has been held for one second
        if (letter === currentLetter && letterStartTime !== -1 && nowInMs - letterStartTime >= 300) {
            // Reset the timer and go forward with the typing
            letterStartTime = -1;
            updateTyper(letter);
        }
        
        const categoryScore = parseFloat(results.gestures[0][0].score * 100).toFixed(2);
        gestureOutput.innerText = `Täht: ${letter}\n Enesekindlus: ${categoryScore} %`;
        document.getElementById('gesture_output').innerHTML = highlightGuess(document.getElementById('gesture_output').innerHTML);
    } else {
        gestureOutput.style.visibility = "hidden";
    }

    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}


function getBoundingBox(landmarks, videoWidth, videoHeight) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of landmarks) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }

    const width = (maxX - minX) * videoWidth;
    const height = (maxY - minY) * videoHeight;

    return { x: minX * videoWidth, y: minY * videoHeight, width, height };
}

function drawText(ctx, text, x, y, color, fontSize = "16px") {
    ctx.font = `${fontSize} Arial`;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

function updateTyper(userGesture) {
    const correctCharacter = text[signIndex];
    const textToTypeElement = document.getElementById("textToType");

    if (userGesture === correctCharacter) {
        // User typed the correct character
        signIndex += 1;
    }

    // Generate the formatted text content
    let formattedText = "";
    for (let i = 0; i < text.length; i++) {
        if (i === 1 && timerStartTime === -1) {
            startTimer();
        }
        if (i < signIndex) {
            formattedText += `<span class="correct">${text[i]}</span>`;
        } else if (i === signIndex) {
            formattedText += `<span class="current">${text[i]}</span>`;
        } else {
            formattedText += `<span class="untyped">${text[i]}</span>`;
        }
    }

    // Update the text content
    textToTypeElement.innerHTML = formattedText;

    // Check if the user has completed typing
    if (signIndex === text.length) {
        // User completed typing
        let textTime = (Date.now() - timerStartTime) / 1000;
        clearInterval(timerInterval);  // Stop the timer when typing is complete
        timerElement.innerText = "";  // Clear the timer display
        alert(`Congratulations! You typed the alphabet in ${textTime} seconds.`);
    }
}

function categoryToLetter(category) {
    const categoryMap = {
        AE: 'Ä',
        OE: 'Ö',
        OY: 'Õ',
        UY: 'Ü',
        ZH: 'Ž',
        SH: 'Š',
    };

    // Convert the category to uppercase for case-insensitive comparison
    const uppercaseCategory = category.toUpperCase();

    // Check if the category exists in the mapping, return the corresponding letter
    if (categoryMap.hasOwnProperty(uppercaseCategory)) {
        return categoryMap[uppercaseCategory];
    }

    // Return the original category if no mapping is found
    return category;
}

function startTimer() {
    timerStartTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const elapsedTimeInSeconds = Math.floor((Date.now() - timerStartTime) / 1000);
    timerElement.innerText = `Timer: ${elapsedTimeInSeconds}s`;
}
