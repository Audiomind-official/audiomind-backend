const express = require('express');
const router = express.Router();
const fs = require('fs');
const { check, validationResult, body } = require('express-validator');
const auth = require('./auth');

// MODELS 
let Property = require('../models/property');


router.get('/:property\.js', auth.optional, async (req, res) => {
    try {

        const property = await Property.findById(req.params.property)

        if (!property) { res.status(404); throw new Error('Property not found') }
        if (property.status == 'TERMINATED') { res.status(500); throw new Error('Property terminated') }
        //if (property.domain != req.get('host')) { res.status(500); throw new Error('Invalid domain') }

        await property.update({ $inc: { 'metrics.hits': 1 } })

        {
            script =  `


            (function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Recorder = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
                "use strict";
                
                module.exports = require("./recorder").Recorder;
                
                },{"./recorder":2}],2:[function(require,module,exports){
                'use strict';
                
                var _createClass = (function () {
                    function defineProperties(target, props) {
                        for (var i = 0; i < props.length; i++) {
                            var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
                        }
                    }return function (Constructor, protoProps, staticProps) {
                        if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
                    };
                })();
                
                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.Recorder = undefined;
                
                var _inlineWorker = require('inline-worker');
                
                var _inlineWorker2 = _interopRequireDefault(_inlineWorker);
                
                function _interopRequireDefault(obj) {
                    return obj && obj.__esModule ? obj : { default: obj };
                }
                
                function _classCallCheck(instance, Constructor) {
                    if (!(instance instanceof Constructor)) {
                        throw new TypeError("Cannot call a class as a function");
                    }
                }
                
                var Recorder = exports.Recorder = (function () {
                    function Recorder(source, cfg) {
                        var _this = this;
                
                        _classCallCheck(this, Recorder);
                
                        this.config = {
                            bufferLen: 4096,
                            numChannels: 2,
                            mimeType: 'audio/wav'
                        };
                        this.recording = false;
                        this.callbacks = {
                            getBuffer: [],
                            exportWAV: []
                        };
                
                        Object.assign(this.config, cfg);
                        this.context = source.context;
                        this.node = (this.context.createScriptProcessor || this.context.createJavaScriptNode).call(this.context, this.config.bufferLen, this.config.numChannels, this.config.numChannels);
                
                        this.node.onaudioprocess = function (e) {
                            if (!_this.recording) return;
                
                            var buffer = [];
                            for (var channel = 0; channel < _this.config.numChannels; channel++) {
                                buffer.push(e.inputBuffer.getChannelData(channel));
                            }
                            _this.worker.postMessage({
                                command: 'record',
                                buffer: buffer
                            });
                        };
                
                        source.connect(this.node);
                        this.node.connect(this.context.destination); //this should not be necessary
                
                        var self = {};
                        this.worker = new _inlineWorker2.default(function () {
                            var recLength = 0,
                                recBuffers = [],
                                sampleRate = undefined,
                                numChannels = undefined;
                
                            self.onmessage = function (e) {
                                switch (e.data.command) {
                                    case 'init':
                                        init(e.data.config);
                                        break;
                                    case 'record':
                                        record(e.data.buffer);
                                        break;
                                    case 'exportWAV':
                                        exportWAV(e.data.type);
                                        break;
                                    case 'getBuffer':
                                        getBuffer();
                                        break;
                                    case 'clear':
                                        clear();
                                        break;
                                }
                            };
                
                            function init(config) {
                                sampleRate = config.sampleRate;
                                numChannels = config.numChannels;
                                initBuffers();
                            }
                
                            function record(inputBuffer) {
                                for (var channel = 0; channel < numChannels; channel++) {
                                    recBuffers[channel].push(inputBuffer[channel]);
                                }
                                recLength += inputBuffer[0].length;
                            }
                
                            function exportWAV(type) {
                                var buffers = [];
                                for (var channel = 0; channel < numChannels; channel++) {
                                    buffers.push(mergeBuffers(recBuffers[channel], recLength));
                                }
                                var interleaved = undefined;
                                if (numChannels === 2) {
                                    interleaved = interleave(buffers[0], buffers[1]);
                                } else {
                                    interleaved = buffers[0];
                                }
                                var dataview = encodeWAV(interleaved);
                                var audioBlob = new Blob([dataview], { type: type });
                
                                self.postMessage({ command: 'exportWAV', data: audioBlob });
                            }
                
                            function getBuffer() {
                                var buffers = [];
                                for (var channel = 0; channel < numChannels; channel++) {
                                    buffers.push(mergeBuffers(recBuffers[channel], recLength));
                                }
                                self.postMessage({ command: 'getBuffer', data: buffers });
                            }
                
                            function clear() {
                                recLength = 0;
                                recBuffers = [];
                                initBuffers();
                            }
                
                            function initBuffers() {
                                for (var channel = 0; channel < numChannels; channel++) {
                                    recBuffers[channel] = [];
                                }
                            }
                
                            function mergeBuffers(recBuffers, recLength) {
                                var result = new Float32Array(recLength);
                                var offset = 0;
                                for (var i = 0; i < recBuffers.length; i++) {
                                    result.set(recBuffers[i], offset);
                                    offset += recBuffers[i].length;
                                }
                                return result;
                            }
                
                            function interleave(inputL, inputR) {
                                var length = inputL.length + inputR.length;
                                var result = new Float32Array(length);
                
                                var index = 0,
                                    inputIndex = 0;
                
                                while (index < length) {
                                    result[index++] = inputL[inputIndex];
                                    result[index++] = inputR[inputIndex];
                                    inputIndex++;
                                }
                                return result;
                            }
                
                            function floatTo16BitPCM(output, offset, input) {
                                for (var i = 0; i < input.length; i++, offset += 2) {
                                    var s = Math.max(-1, Math.min(1, input[i]));
                                    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                                }
                            }
                
                            function writeString(view, offset, string) {
                                for (var i = 0; i < string.length; i++) {
                                    view.setUint8(offset + i, string.charCodeAt(i));
                                }
                            }
                
                            function encodeWAV(samples) {
                                var buffer = new ArrayBuffer(44 + samples.length * 2);
                                var view = new DataView(buffer);
                
                                /* RIFF identifier */
                                writeString(view, 0, 'RIFF');
                                /* RIFF chunk length */
                                view.setUint32(4, 36 + samples.length * 2, true);
                                /* RIFF type */
                                writeString(view, 8, 'WAVE');
                                /* format chunk identifier */
                                writeString(view, 12, 'fmt ');
                                /* format chunk length */
                                view.setUint32(16, 16, true);
                                /* sample format (raw) */
                                view.setUint16(20, 1, true);
                                /* channel count */
                                view.setUint16(22, numChannels, true);
                                /* sample rate */
                                view.setUint32(24, sampleRate, true);
                                /* byte rate (sample rate * block align) */
                                view.setUint32(28, sampleRate * 4, true);
                                /* block align (channel count * bytes per sample) */
                                view.setUint16(32, numChannels * 2, true);
                                /* bits per sample */
                                view.setUint16(34, 16, true);
                                /* data chunk identifier */
                                writeString(view, 36, 'data');
                                /* data chunk length */
                                view.setUint32(40, samples.length * 2, true);
                
                                floatTo16BitPCM(view, 44, samples);
                
                                return view;
                            }
                        }, self);
                
                        this.worker.postMessage({
                            command: 'init',
                            config: {
                                sampleRate: this.context.sampleRate,
                                numChannels: this.config.numChannels
                            }
                        });
                
                        this.worker.onmessage = function (e) {
                            var cb = _this.callbacks[e.data.command].pop();
                            if (typeof cb == 'function') {
                                cb(e.data.data);
                            }
                        };
                    }
                
                    _createClass(Recorder, [{
                        key: 'record',
                        value: function record() {
                            this.recording = true;
                        }
                    }, {
                        key: 'stop',
                        value: function stop() {
                            this.recording = false;
                        }
                    }, {
                        key: 'clear',
                        value: function clear() {
                            this.worker.postMessage({ command: 'clear' });
                        }
                    }, {
                        key: 'getBuffer',
                        value: function getBuffer(cb) {
                            cb = cb || this.config.callback;
                            if (!cb) throw new Error('Callback not set');
                
                            this.callbacks.getBuffer.push(cb);
                
                            this.worker.postMessage({ command: 'getBuffer' });
                        }
                    }, {
                        key: 'exportWAV',
                        value: function exportWAV(cb, mimeType) {
                            mimeType = mimeType || this.config.mimeType;
                            cb = cb || this.config.callback;
                            if (!cb) throw new Error('Callback not set');
                
                            this.callbacks.exportWAV.push(cb);
                
                            this.worker.postMessage({
                                command: 'exportWAV',
                                type: mimeType
                            });
                        }
                    }], [{
                        key: 'forceDownload',
                        value: function forceDownload(blob, filename) {
                            var url = (window.URL || window.webkitURL).createObjectURL(blob);
                            var link = window.document.createElement('a');
                            link.href = url;
                            link.download = filename || 'output.wav';
                            var click = document.createEvent("Event");
                            click.initEvent("click", true, true);
                            link.dispatchEvent(click);
                        }
                    }]);
                
                    return Recorder;
                })();
                
                exports.default = Recorder;
                
                },{"inline-worker":3}],3:[function(require,module,exports){
                "use strict";
                
                module.exports = require("./inline-worker");
                },{"./inline-worker":4}],4:[function(require,module,exports){
                (function (global){
                "use strict";
                
                var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();
                
                var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };
                
                var WORKER_ENABLED = !!(global === global.window && global.URL && global.Blob && global.Worker);
                
                var InlineWorker = (function () {
                  function InlineWorker(func, self) {
                    var _this = this;
                
                    _classCallCheck(this, InlineWorker);
                
                    if (WORKER_ENABLED) {
                      var functionBody = func.toString().trim().match(/^function\\s*\\w*\\s*\\([\\w\\s,]*\\)\\s*{([\\w\\W]*?)}$/)[1];
                      var url = global.URL.createObjectURL(new global.Blob([functionBody], { type: "text/javascript" }));
                
                      return new global.Worker(url);
                    }
                
                    this.self = self;
                    this.self.postMessage = function (data) {
                      setTimeout(function () {
                        _this.onmessage({ data: data });
                      }, 0);
                    };
                
                    setTimeout(function () {
                      func.call(self);
                    }, 0);
                  }
                
                  _createClass(InlineWorker, {
                    postMessage: {
                      value: function postMessage(data) {
                        var _this = this;
                
                        setTimeout(function () {
                          _this.self.onmessage({ data: data });
                        }, 0);
                      }
                    }
                  });
                
                  return InlineWorker;
                })();
                
                module.exports = InlineWorker;
                }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
                },{}]},{},[1])(1)
                });

            
            /* Máscaras ER */
            function mascara(o,f){
                v_obj=o
                v_fun=f
                setTimeout(execmascara(),1)
            }
            function execmascara(){
                v_obj.value=v_fun(v_obj.value)
            }
            function mtel(v){
                v=v.replace(/\\D/g,"");             //Remove tudo o que não é dígito
                v=v.replace(/^(\\d{2})(\\d)/g,"($1) $2"); //Coloca parênteses em volta dos dois primeiros dígitos
                v=v.replace(/(\\d)(\\d{4})$/,"$1-$2");    //Coloca hífen entre o quarto e o quinto dígitos
                return v;
            }

            (function() {

            document.addEventListener("DOMContentLoaded", function() {


                function hexToRgb(hex) {
                    var result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
                    return result ? {
                      r: parseInt(result[1], 16),
                      g: parseInt(result[2], 16),
                      b: parseInt(result[3], 16)
                    } : null;
                  }
                
                
                let rgb = hexToRgb("#$COLOR");
                
                  

                var style = document.createElement('style');
                style.type = 'text/css';
                style.innerHTML = \`


                ol {
                    list-style: none;
                    padding: 0;
                }

                #chat__popup {
                    border-radius: 0.5rem;
                    background: white;
                    padding: 1rem;
                    margin: 1rem 0;
                    display: none;
                    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.1);
                }

                #tl-button {
                    display: block;
                    transition: 0.3s all;
                    padding: 0.5rem 1rem;
                    background: #$COLOR;
                    color: white;
                    text-align: center;
                    text-decoration: none;
                    border-radius: 0 .25rem .25rem 0;
                }
                
                #tl-container {
                    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.125);
                    padding: 1rem;
                    border-radius: 0.25rem;
                    max-width: 30rem;
                    width: 100%;
                    margin: auto;
                }

                #tl-recorder {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }



                #tl-box {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    transition: all 0.3s;
                }

                #tl-box.recording {
                    background: #$COLOR;
                    color: white;
                    padding: 0.5rem;
                    border-radius: 0.25rem;
                    
                      
                      -webkit-animation-name: recording; /* Safari 4.0 - 8.0 */
                      -webkit-animation-duration: 0.7s; /* Safari 4.0 - 8.0 */
                      animation-name: recording;
                      animation-duration: 0.7s;
                      animation-iteration-count: infinite;
                      animation-direction: reverse;
                }
                
                #tl-controls {
                    background: #$COLOR;
                    color: white;
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    font-size: 1.25rem;
                    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.25);
                    transition: all 0.3s;
                    border-radius: 2.5rem;
                    padding: 0.5rem;


                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                #tl-form__controls {
                    display: flex;
                    align-items: stretch;
                    max-width: 300px;
                    margin: auto;
                    margin-bottom: 1rem;
                }

                #tl-phone {
                    margin: 0;
                    flex: 1;
                    display: block;
                    padding: 0.5rem;
                    font-family: inherit;
                    border-radius: .25rem 0 0 .25rem;
                    border: 1px solid #ccc;
                    border-right: none;
                }

                #tl-phone:focus {
                    border: 2px solid #$COLOR;
                    outline: none;
                }

                @keyframes recording {
                    from {
                      opacity: 1;
                    }
                  
                    to {
                        opacity: 0.8;
                    }
                  }

                #trialead-recorder {
                    padding: 1rem;
                    font-family: inherit;
                }

                #recordButton:disabled,
                #stopButton:disabled {
                    display: none;
                }

                #recordButton,
                #stopButton {
                    background: none;
                    border: none;
                    padding: 0.25rem;
                }

                #tl-disclaimer {    font-size: .75em;
                    text-align: left;
                    opacity: .75;
                
                    display: none;
                }
                #tl-label {    font-size: .75em;
                    text-align: left;
                    font-weight: bold;
                    display: block;
                    margin: auto;
                    max-width: 300px;
                
                }
                
                .recording #tl-disclaimer {
                    display: block;
                }

                #trialead-recorder * {
                    box-sizing: border-box;
                }\`;
                document.getElementsByTagName('head')[0].appendChild(style);

                var target = document.getElementById( "trialead" );


                // create a new div element 
                recorder = \`
                
                <div id="trialead-recorder">
                
                <div id="tl-container">
                <div id="tl-box" style="display: block;">

                    <div id="tl-recorder">
                        <p id="tl-message">Mande sua dúvida por áudio</p>

                        <div id="tl-controls">
                            <button id="recordButton"><img src="https://app.trialead.com.br/assets/recorder/icon_record.svg" alt="Gravar" width="25px"></button>
                            <button id="stopButton" disabled=""><img src="https://app.trialead.com.br/assets/recorder/icon_send.svg" alt="Parar" width="25px"></button>
                        </div>
                    </div>

                    <div id="tl-disclaimer">Não se esqueça de permitir o microfone</div>


                    <div>
                        <form style="display: none; text-align: center;" id="tl-form" action="">
                            <ol id="recordingsList"></ol>
                            <a style="font-size: 0.8rem;" href="javascript:;" onclick="var element = document.getElementById('trialead-recorder'); element.parentNode.removeChild(element);   document.getElementById( 'trialead' ).insertAdjacentHTML('afterend', recorder); listen();">Gravar novamente</a>
                           
                           <label for="tl-phone" id="tl-label">Seu telefone</label>
                            <div id="tl-form__controls" > 
                            <input type="text" name="tl-phone"  onkeyup="mascara( this, mtel );" maxlength="15" id="tl-phone" placeholder="(00) 99999-9999" style="font-size: 1rem; padding: 0.25rem; width: 100%;">
                            
                    </div><small style="
                    font-size: 0.5rem;
                    opacity: 0.5;">Ao enviar, você concorda com os termos de uso e privacidade</small>
                        </form> 
                    </div>

                    <div id="message" style="display: none; text-align: center;">
                        <h3>Mensagem enviada com sucesso!</h3>
                    </div>
                </div>
                <div style="text-align:center; margin-top: 1rem;"><a href="https://app.trialead.com.br/" target="_blank" style="font-size: 0.65rem;
        text-decoration: none;
        color: rgba(0,0,0,0.5);">Por AudioMind</a></div>
            </div>
            
            </div>
                
                \`

            
                // add the newly created element and its content into the DOM 
                target.insertAdjacentHTML('afterend', recorder);

                   

        listen = function() {

            $("#tl-form").submit(function (e) {
                var xhr = new XMLHttpRequest();
                xhr.onload = function (e) {
                    if (this.readyState === 4) {
                        console.log("Server returned: ", e.target.responseText);
                    }
                };
                var fd = new FormData();
                fd.append("audio_data", blob, filename);
                xhr.open("POST", "upload.php", true);
                xhr.send(fd);
                return false;
            });

            $('#chat__btn').click(function () {
                $('#chat__popup').slideToggle();
            })
            $('#chat__popup').delay(00).slideDown();


            recordButton = document.getElementById("recordButton");
            stopButton = document.getElementById("stopButton");

            //add events to those 2 buttons
            recordButton.addEventListener("click", startRecording);
            stopButton.addEventListener("click", stopRecording);

        }

        listen()


                //webkitURL is deprecated but nevertheless
                URL = window.URL || window.webkitURL;

                var gumStream; //stream from getUserMedia()
                var rec; //Recorder.js object
                var input; //MediaStreamAudioSourceNode we'll be recording

                // shim for AudioContext when it's not avb. 
                var AudioContext = window.AudioContext || window.webkitAudioContext;
                var audioContext //audio context to help us record

                function startRecording() {
                    console.log("recordButton clicked");
                    $("#tl-message").html("Gravando...")
                    $("#tl-box").addClass("recording");

                    /*
                        Simple constraints object, for more advanced audio features see
                        https://addpipe.com/blog/audio-constraints-getusermedia/
                    */

                    var constraints = {
                        audio: true,
                        video: false
                    }

                    /*
                Disable the record button until we get a success or fail from getUserMedia() 
            */

                    recordButton.disabled = true;
                    stopButton.disabled = false;

                    /*
                We're using the standard promise based getUserMedia() 
                https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
            */

                    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
                        console.log("getUserMedia() success, stream created, initializing Recorder.js ...");

                        /*
                            create an audio context after getUserMedia is called
                            sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
                            the sampleRate defaults to the one set in your OS for your playback device
                        */
                        audioContext = new AudioContext();

                        //update the format 
                        //document.getElementById("formats").innerHTML="Format: 1 channel pcm @ "+audioContext.sampleRate/1000+"kHz"

                        /*  assign to gumStream for later use  */
                        gumStream = stream;

                        /* use the stream */
                        input = audioContext.createMediaStreamSource(stream);

                        /* 
                            Create the Recorder object and configure to record mono sound (1 channel)
                            Recording 2 channels  will double the file size
                        */
                        rec = new Recorder(input, {
                            numChannels: 1
                        })

                        //start the recording process
                        rec.record()

                        console.log("Recording started");

                    }).catch(function (err) {
                        //enable the record button if getUserMedia() fails
                        recordButton.disabled = false;
                        stopButton.disabled = true;
                    });
                }

                function stopRecording() {
                    console.log("stopButton clicked");
                    $("#tl-box").removeClass("recording");
                    $("#tl-controls").hide()
                    $("#tl-message").hide()

                    //disable the stop button, enable the record too allow for new recordings
                    stopButton.disabled = true;
                    recordButton.disabled = false;

                    //reset button just in case the recording is stopped while paused

                    //phonel the recorder to stop the recording
                    rec.stop();

                    //stop microphone access
                    gumStream.getAudioTracks()[0].stop();

                    //create the wav blob and pass it on to createDownloadLink
                    rec.exportWAV(createDownloadLink);
                }

                function createDownloadLink(blob) {

                    var url = URL.createObjectURL(blob);
                    var au = document.createElement('audio');
                    var li = document.createElement('li');
                    var link = document.createElement('a');

                    //name of .wav file to use during upload and download (without extendion)
                    var filename = new Date().toISOString();

                    //add controls to the <audio> element
                    au.controls = true;
                    au.src = url;

                    //save to disk link
                    link.href = url;
                    link.download = filename + ".wav"; //download forces the browser to donwload the file using the  filename
                    link.innerHTML = "Save to disk";

                    //add the new audio element to li
                    li.appendChild(au);

                    //add the filename to the li
                    //li.appendChild(document.createTextNode(filename+".wav "))

                    //add the save to disk link to li
                    //li.appendChild(link);

                    //upload link
                    var upload = document.createElement('a');
                    upload.setAttribute("id", "tl-button");
                    upload.href = "#";
                    upload.innerHTML = "Enviar";
                    upload.addEventListener("click", function (event) {
                        $("#tl-button").html("Aguarde...");
                        if (document.getElementById("tl-phone").value.length < 13) {
                            
                            $("#tl-button").html("Enviar");
                            alert("Telefone é obrigatório")
                            return false;
                        }
                        var xhr = new XMLHttpRequest();
                        xhr.onload = function (e) {
                            if (this.readyState === 4) {

                                $('#tl-form').slideUp();
                                $('#message').slideDown();
                                console.log("Server returned: ", e.target.responseText);
                            }
                        };
                        var fd = new FormData();
                        fd.append("file", blob, filename);
                        fd.append("phone", $('#tl-phone').val());
                        xhr.open("POST", "https://app.trialead.com.br/api/properties/$PROPERTY/public", true);
                        xhr.send(fd);
                    })
                    li.appendChild(document.createElement("div")) //add a space in between
                    document.getElementById("tl-form__controls").appendChild(upload) //add the upload link to li

                    //add the li element to the ol
                    recordingsList.appendChild(li);

                    $('#tl-form').slideDown();
                    $('#tl-controls').slideUp();
                }
            
            });
        })();`

        
        }

        let color = req.query.color || 'ccc'

        let out = script.replace(/\$PROPERTY/g, req.params.property).replace(/\$COLOR/g, color)

        res.setHeader('content-type', 'text/javascript')
        res.write(out)
        res.end()

    } catch(err) {

        console.log(err)
        res.end();

    }
});


module.exports = router;