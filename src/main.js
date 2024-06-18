import MeasureProcessor from 'worklet:./processor.js';

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
    $("#sample-rate")[0].innerText = ac.sampleRate;
    var canvas = $("canvas")[0];
    var canvas_debug = $("canvas")[1];
    if (window.innerWidth < 1024) {
        canvas.width = window.innerWidth * 0.95;
        canvas.height = canvas.width * 0.75;
    }
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext("2d");
    var analyser = new AnalyserNode(ac);
    analyser.fftSize = 2048;
    var buf = new Float32Array(analyser.frequencyBinCount);
    var cvs_step = w / buf.length;
    var initialSetup = false;

    var inputProcessing = document.location.search.indexOf("input-processing") != -1;
    var debugCanvas = document.location.search.indexOf("debug") != -1;

    console.log("Input processing: ", inputProcessing);
    console.log("Debug canvas", debugCanvas);

    if (!debugCanvas) {
        canvas_debug.remove();
    }

    threshold = $("input[type=range]")[0].value;

    function draw() {
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#333";
        analyser.getFloatTimeDomainData(buf);
        var acc = 0;
        var t = true;
        [parseFloat(threshold), -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75].forEach(function (v) {
            if (t) {
                ctx.strokeStyle = "#a00";
                t = false;
            } else {
                ctx.strokeStyle = "#aaa";
            }
            ctx.fillText(v, 3, h / 2 - (v * h / 2) + 3);
            ctx.beginPath();
            ctx.moveTo(30, h / 2 - (v * h / 2));
            ctx.lineTo(w - 30, h / 2 - (v * h / 2));
            ctx.stroke();
            ctx.closePath();
        });
        for (var i = 0; i < buf.length; i++) {
            ctx.fillRect(acc, h / 2, cvs_step, buf[i] * h / 2);
            acc += cvs_step;
        }
        requestAnimationFrame(draw);
    }

    if (stop) {
        requestAnimationFrame(draw);
    }

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
        draw();
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
                if(true){
                    const gainNode = ac.createGain()
                    const defaultGain = 50
                    gainNode.gain.value = defaultGain

                    mic_source.connect(gainNode)
                    
                    const dest = ac.createMediaStreamDestination()
             
                    gainNode.connect(worklet_node)
                    gainNode.connect(analyser)
                    gainNode.connect(dest)
                    worklet_node.connect(ac.destination);
                } else {
                    mic_source.connect(analyser); // original code
                    mic_source.connect(worklet_node).connect(ac.destination); // original code
                }              

                worklet_node.port.postMessage({ threshold: $("input")[0].value });


                worklet_node.port.onmessage = function (e) {
                    if (debugCanvas) {
                        var c2 = canvas_debug.getContext("2d");
                        var w2 = canvas_debug.width;
                        var h2 = canvas_debug.height;
                        var between_peaks = e.data.array;
                        var len = e.data.array.length;
                        var wstep = w2 / len;

                        c2.clearRect(0, 0, w2, h2);

                        c2.fillStyle = "#000";
                        var x = 0;
                        for (var i = 0; i < len; i++) {
                            c2.fillRect(x, h2 / 2, wstep, between_peaks[i] * h2 / 2);
                            x += wstep;
                        }
                        c2.fillStyle = "#f00";
                        c2.fillRect(w2 - wstep * e.data.offset, 0, wstep, h);

                        c2.fillRect(w2 - wstep * e.data.delay_frames - wstep * e.data.offset, h2 *
                            0.75, w2 - wstep * e.data.delay_frames, 4);
                    }

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
        }
    }
}
main();