import MeasureProcessor from 'worklet:./processor.js'
const safariVersionIndex = navigator.userAgent.indexOf('Version/')
const versionString = navigator.userAgent.substring(safariVersionIndex + 8)
const safariVersion = parseFloat(versionString)
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

$ = document.querySelectorAll.bind(document);

export class TestLatency {

    ac = null

    analyser = null // not necessary

    initialSetup = false

    inputProcessing = false

    stop = true // not necessary

    static initialize() {
        TestLatency.ac = new AudioContext();
    
        TestLatency.analyser = new AnalyserNode(TestLatency.ac);
        TestLatency.analyser.fftSize = 2048;
            
        //var initialSetup = false;
    
        TestLatency.inputProcessing = document.location.search.indexOf("input-processing") != -1;
        
        console.log("Input processing: ", TestLatency.inputProcessing);
    }
    static async startTest() {       
        
        $("button#stop")[0].disabled = false;
        $("button#start")[0].disabled = true;
        TestLatency.stop = false;
        await TestLatency.ac.resume();
        try {
            //await TestLatency.ac.resume();
            if (!TestLatency.initialSetup) {
                await TestLatency.ac.audioWorklet.addModule(MeasureProcessor);
                var constraints = TestLatency.inputProcessing ? {
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

                var mic_source = TestLatency.ac.createMediaStreamSource(stream);
                var worklet_node = new AudioWorkletNode(TestLatency.ac, 'measure-processor', { outputChannelCount: [1] });
                worklet_node.channelCount = 1;

                // For Safari 16 and above when using echocancellation to false
                // the input is dramatically reduced
                let defaultGain = 1
                if (isSafari && safariVersion > 16) {
                    defaultGain = 50
                }
                const gainNode = TestLatency.ac.createGain()
                gainNode.gain.value = defaultGain

                mic_source.connect(gainNode)

                gainNode.connect(worklet_node)
                gainNode.connect(TestLatency.analyser)

                worklet_node.connect(TestLatency.ac.destination)

                //worklet_node.port.postMessage({ threshold: $("input")[0].value });

                worklet_node.port.onmessage = function (e) {
                    $("#latency")[0].innerText = (e.data.latency * 1000) + "ms"
                    $("#computed")[0].innerText = (TestLatency.ac.outputLatency * 1000) + "ms"
                }

                // $("input[type=range]")[0].oninput = (e) => {
                //     threshold = e.target.value;
                //     worklet_node.port.postMessage({ threshold: e.target.value });
                // };
                TestLatency.initialSetup = true;
            }
        } catch (e) {
            console.log(e)
        }
    }

    static stopTest() {
        TestLatency.ac.suspend();
        $("button#stop")[0].disabled = true;
        $("button#start")[0].disabled = false;
        TestLatency.stop = true;
    }

}