import { TestLatency } from "./testlatency";

function main() {
    if (!window.AudioWorkletNode) {
        alert("This experiment requires AudioWorklet, please try this on Firefox beta 76 and more recent");
        return;
    }
    const inputProcessing = document.location.search.indexOf("input-processing") != -1;

    console.log("Input processing: ", inputProcessing)

    const constraints = inputProcessing ? {
        audio: {
            // disabling this because we're intentionally trying to echo 
            echoCancellation: false,
            noiseSupression: true,
            autoGainControl: true
        }
    } : {
        audio: {
            echoCancellation: false,
            noiseSupression: false,
            autoGainControl: false
        }
    }
    
    TestLatency.initialize(constraints)
}

main()