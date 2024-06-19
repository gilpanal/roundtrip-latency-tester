import MeasureProcessor from 'worklet:./processor.js'
const safariVersionIndex = navigator.userAgent.indexOf('Version/')
const versionString =  navigator.userAgent.substring(safariVersionIndex + 8)
const safariVersion = parseFloat(versionString)
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

function main() {
    if (!window.AudioWorkletNode) {
        alert("This experiment requires AudioWorklet, please try this on Firefox beta 76 and more recent");
        return;
    }    
    $ = document.querySelectorAll.bind(document);
    $("button#start")[0].onclick = start;
    $("button#stop")[0].onclick = stopFunc;
    $("button#stop")[0].disabled = true;

    var ac = new AudioContext();
    
    var analyser = new AnalyserNode(ac);
    analyser.fftSize = 2048;
        
    var initialSetup = false;

    var inputProcessing = document.location.search.indexOf("input-processing") != -1;
    
    console.log("Input processing: ", inputProcessing);
    
    threshold = $("input[type=range]")[0].value; 

    function stopFunc() {
        ac.suspend();
        $("button#stop")[0].disabled = true;
        $("button#start")[0].disabled = false;
        stop = true;
    }

    async function start() {
        $("button#stop")[0].disabled = false;
        $("button#start")[0].disabled = true;
        stop = false;
        await ac.resume();
        try {
            await ac.resume();
            if (!initialSetup) {
                await ac.audioWorklet.addModule(MeasureProcessor);
                var constraints = inputProcessing ? {
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
                };
                let stream = await navigator.mediaDevices.getUserMedia(constraints);

                var mic_source = ac.createMediaStreamSource(stream);
                var worklet_node = new AudioWorkletNode(ac, 'measure-processor', { outputChannelCount: [1] });
                worklet_node.channelCount = 1;

                // For Safari 16 and above when using echocancellation to false
                // the input is dramatically reduced
                let defaultGain = 1
                if(isSafari && safariVersion > 16){
                    defaultGain = 50
                }
                const gainNode = ac.createGain()                
                gainNode.gain.value = defaultGain

                mic_source.connect(gainNode)
            
                gainNode.connect(worklet_node)
                gainNode.connect(analyser)                

                worklet_node.connect(ac.destination)                        

                worklet_node.port.postMessage({ threshold: $("input")[0].value });

                worklet_node.port.onmessage = function (e) {
                    $("#latency")[0].innerText = (e.data.latency * 1000) + "ms"
                    $("#computed")[0].innerText = (ac.outputLatency * 1000) + "ms"
                }

                $("input[type=range]")[0].oninput = (e) => {
                    threshold = e.target.value;
                    worklet_node.port.postMessage({ threshold: e.target.value });
                };
                initialSetup = true;
            }
        } catch (e) {
            console.log(e)
        }
    }
}
main();