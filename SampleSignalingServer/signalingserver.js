import WebSocket from 'ws';
import * as uuid from 'uuid';
import express from 'express';
import http from 'http';

const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({ server });
const clients = {};

app.use(express.static('public'));

wss.on('connection', (ws, req) => {
    ws.peerId = uuid.v4();
    ws.peerType = req.url.substr(req.url.indexOf('=') + 1);
    clients[ws.peerId] = ws;
    console.log(`[Connect ${ws.peerId}, ${ws.peerType}]`);

    const broadcast = (msg) => {
        Object.keys(clients).forEach(id => {
            if (id !== ws.peerId && clients[id].readyState === WebSocket.OPEN && msg) {
                console.log(`broadcast msg: ${msg}`);
                clients[id].send(msg);
            }
        });
    };

    broadcast(JSON.stringify({ joinId: ws.peerId, type: 'join' }));

    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        msg.srcId = ws.peerId;
        console.log(`[Receive ${ws.peerId}] ${msg.type}`);
        if (msg.dstId) {
            if (clients[msg.dstId]) {
                console.log(msg);
                clients[msg.dstId].send(JSON.stringify(msg));
            } else {
                console.log(`clients[${msg.dstId}] is null`);
            }
        } else {
            broadcast(JSON.stringify(msg));
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`[Close ${ws.peerId}] code:${code}, reason:${reason}`);
        broadcast(JSON.stringify({ leaveId: ws.peerId, type: 'leave' }));
        delete clients[ws.peerId];
    });

    ws.on('error', (err) => {
        console.log(`[Error ${ws.peerId}]  err:${err.message}`);
    });
});

server.listen(8989, _ => {
    console.log('http://localhost:8989');
});