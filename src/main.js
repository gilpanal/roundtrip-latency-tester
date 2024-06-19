import { TestLatency } from "./testlatency";
function main() {
    if (!window.AudioWorkletNode) {
        alert("This experiment requires AudioWorklet, please try this on Firefox beta 76 and more recent");
        return;
    }
    
    TestLatency.initialize()
    $ = document.querySelectorAll.bind(document);
    $("button#start")[0].onclick = TestLatency.startTest;
    $("button#stop")[0].onclick = TestLatency.stopTest;
    $("button#stop")[0].disabled = true;  
    
    //threshold = $("input[type=range]")[0].value; 
}
main();