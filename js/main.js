"use strict"

// config

// uncomment to use your locally running signalling server
var serverIP = "http://localhost:2013";

//my signalling server
//var serverIP = "http://45.55.61.164:2013/";

// RTCPeerConnection Options
var server = {
    // Uses Google's STUN server
    iceServers: [{
        "url": "stun:stun.xten.com"
    }, 
    {
    // Use my TURN server on DigitalOcean
        'url': 'turn:numb.viagenie.ca',
        'credential': 'sunghiep',
        'username': 'nghiepnds@yahoo.com'
    }]
};


var localPeerConnection, signallingServer;

var btnSend = document.getElementById('btn-send');
var btnVideoStop = document.getElementById('btn-video-stop');
var btnVideoStart = document.getElementById('btn-video-start');
var btnVideoJoin = document.getElementById('btn-video-join');
var localVideo = document.getElementById('local-video');
var remoteVideo = document.getElementById('remote-video');
var inputRoomName = document.getElementById('room-name');

var localStream, localIsCaller;


var sdpConstraints = {
    optional: [],
    mandatory: {
        OfferToReceiveVideo: true
    }
};

// declare RTCPeerConnection
window.RTCPeerConnection =  window.RTCPeerConnection || window.mozRTCPeerConnection ||
                            window.webkitRTCPeerConnection || window.msRTCPeerConnection;
// declare RTCSessionDescription (SDP)
window.RTCSessionDescription =  window.RTCSessionDescription || window.mozRTCSessionDescription ||
                                window.webkitRTCSessionDescription || window.msRTCSessionDescription;

// declare the getUserMedia
navigator.getUserMedia =    navigator.getUserMedia || navigator.mozGetUserMedia ||
                            navigator.webkitGetUserMedia || navigator.msGetUserMedia;

//in other example I use: navigator.mediaDevices.getUserMedia. WHY is different here????

window.SignallingServer = window.SignallingServer;

// start the video a Room
btnVideoStart.onclick = function(e) {
    e.preventDefault();
    // is starting the call
    localIsCaller = true;
    initConnection();
};

btnVideoJoin.onclick = function(e) {
    e.preventDefault();
    // just joining a call, not offering
    localIsCaller = false;
    initConnection();
};

btnVideoStop.onclick = function(e) {
    e.preventDefault();
    // stop video stream
    if (localStream != null) {
        localStream.stop();
    }

    // kill all connections
    if (localPeerConnection != null) {
        localPeerConnection.removeStream(localStream);
        localPeerConnection.close();
        signallingServer.close();
        localVideo.src = "";
        remoteVideo.src = "";
    }

    btnVideoStart.disabled = false;
    btnVideoJoin.disabled = false;
    btnVideoStop.disabled = true;
};

function initConnection() {
    //get room's name
    var room = inputRoomName.value;

    if (room == undefined || room.length <= 0) {
        alert('Please enter room name');
        return;
    }

    // start connection!
    connect(room);

    btnVideoStart.disabled = true;
    btnVideoJoin.disabled = true;
    btnVideoStop.disabled = false;
}

//
function connect(room) {
    // Step 1 - Create peer connection
    localPeerConnection = new RTCPeerConnection(server);

    // create local data channel, send it to remote
    navigator.getUserMedia({
        video: true,
        audio: true
    }, function(stream) {
        // get and save local stream
        trace('Got stream, saving it now and starting RTC conn');

        // Step 2 - Add stream to peer connection
        localPeerConnection.addStream(stream);
        localStream = stream;

        // Step 3 - Show local video
        localVideo.src = window.URL.createObjectURL(stream);
        //localVideo.srcObject = stream; //same result

        // can start once have gotten local video
        establishRTCConnection(room);

    }, errorHandler)
};

function establishRTCConnection(room) {
    // create signalling server
    signallingServer = new SignallingServer(room, serverIP);
    signallingServer.connect();


    // a remote peer has joined room, initiate sdp exchange
    signallingServer.onGuestJoined = function() {
        trace('guest joined!')
        // Step 4 - Create offer,
        localPeerConnection.createOffer(function(sessionDescription) {
            trace('set local session desc with offer');
            // Step 5 - Set local description
            localPeerConnection.setLocalDescription(sessionDescription);

            // Step 6 - Send local sdp to remote
            signallingServer.sendSDP(sessionDescription);
        });
    };

    // got sdp from remote, as client does not know it is receiving or sending SDP
    signallingServer.onReceiveSdp = function(sdp) {
        // get stream again, DO WE NEED IT?????
        localPeerConnection.addStream(localStream);
        //trace(localStream)

        // LOCAL CLIENT IS CALLER
        if (localIsCaller) {
            trace('is caller');
            trace('set remote session desc with answer');
            // Step 7 - Set the remote SDP
            localPeerConnection.setRemoteDescription(new RTCSessionDescription(
                sdp));
        }
        // LOCAL CLIENT IS JOINER
        else {
            trace('set remote session desc with offer');
            // Step 7 - Receiving remote SDP
            localPeerConnection.setRemoteDescription(new RTCSessionDescription(
                sdp), function() {
                trace('make answer')
                // Step 8 - Create an answer
                localPeerConnection.createAnswer(function(
                    sessionDescription) {
                    // Step 8 - Set local description from the incoming SDP
                    trace('set local session desc with answer');
                    localPeerConnection.setLocalDescription(
                        sessionDescription);

                    // Step 9 - Send local sdp to remote
                    signallingServer.sendSDP(sessionDescription);
                });
            });
        }
    };

    // ICE Candidate is created when cannot establish the peer connection due to NAT/FIREWALL
    // when received ICE candidate info
    signallingServer.onReceiveICECandidate = function(candidate) {
        trace('Set remote ice candidate');
        localPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    };

    // when room is full, alert user
    signallingServer.onRoomFull = function(room) {
        window.alert('Room "' + room +
            '"" is full! Please join or create another room');
    };

    // get ice candidates and send them over
    // wont get called unless SDP has been exchanged
    localPeerConnection.onicecandidate = function(event) {
        if (event.candidate) {
            //!!! send ice candidate over via signalling channel
            trace("Sending candidate");
            signallingServer.sendICECandidate(event.candidate);
        }
    };

    // when stream is added to connection, put it in video src
    localPeerConnection.onaddstream = function(data) {
        remoteVideo.src = window.URL.createObjectURL(data.stream);
    }

}

function errorHandler(error) {
    console.error('Something went wrong!');
    console.error(error);
}

function trace(text) {
    console.info(text);
}