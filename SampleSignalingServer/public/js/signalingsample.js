const peers = {};
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

let signaling = null;

let stream = null;

connectButton.onclick = connect;

function connect() {
    signaling = new WebSocket('ws://localhost:8989?type=web');

    signaling.onopen = evt => {
        console.log('[Signaling OnOpen]');
    };

    signaling.onmessage = async evt => {
        const msg = JSON.parse(evt.data);

        console.log(`[Signaling Receive Message] type:${msg.type} dstId:${msg.dstId}`);
        if (msg.joinId) console.log(`Join: ${msg.joinId}`);
        if (msg.leaveId) console.log(`Leave: ${msg.leaveId}`);
        const id = msg.joinId || msg.srcId;
        console.log(`id:${id}`);
        let pc = peers[id] || await createPeer(id, !!msg.joinId);

        if (msg.sdp) {
            console.log(`[SetRemoteDescription ${msg.type}]`);
            await pc.setRemoteDescription(msg);
            if (msg.type === 'offer') {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                send(pc.localDescription.toJSON());
            }
        }

        if (msg.candidate) {
            await pc.addIceCandidate(msg);
        }
    };

    signaling.onclose = evt => {
        console.log(`[Signaling OnClose] Code:${evt.code}, Reason:${evt.reason}`);
    };

    signaling.onerror = evt => {
        console.log(`[Signaling OnError]`);
    };
};

async function createPeer(id, caller) {
    console.log(`id: ${id}  caller: ${caller}`);
    const pc = peers[id] = new RTCPeerConnection(config);

    pc.onicecandidate = evt => {
        if (evt.candidate) {
            console.log(`send candidate to dstId: ${id}`);
            send({ ...evt.candidate.toJSON(), type: 'candidate' }, id);
        }
    };

    pc.ontrack = evt => {
        console.log(`ontrack ${evt.track.kind}`);
        if (evt.track.kind === 'video') {
            createPeerItem(evt.streams[0] || new MediaStream([evt.track]), id);
        }
    };

    if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    stream.getTracks().forEach(track => {
        console.log(`addTrack: ${track.kind}`);
        pc.addTrack(track, stream)
    });

    if (caller) {
        console.log('createOffer');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('send offer');
        send(pc.localDescription.toJSON(), id);
    }

    return pc;
}

function createPeerItem(stream, id) {
    const vid = document.createElement('video');
    vid.id = `vid_${id}`;
    vid.srcObject = stream;
    vid.setAttribute('playsinline', true);
    vid.muted = true;
    vid.play();
    peerList.appendChild(vid);
}

function send(data, id) {
    console.log(`send to dstId: ${id}`);
    const sendData = { ...data, dstId: id };
    if (signaling)
        signaling.send(JSON.stringify(sendData));
}