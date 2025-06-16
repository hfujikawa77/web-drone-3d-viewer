const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dgram = require('dgram');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static('.'));

// UDP client for MAVLink
const udpClient = dgram.createSocket('udp4');
const MAVLINK_PORT = 14551;

// MAVLink message IDs
const MAVLINK_MSG_ID_HEARTBEAT = 0;
const MAVLINK_MSG_ID_ATTITUDE = 30;
const MAVLINK_MSG_ID_GLOBAL_POSITION_INT = 33;

// Debug counters
let messageCount = 0;
let mavlinkCount = 0;
let parseErrors = 0;

// WebSocket connections
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected');
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected');
    });
});

// Helper function to convert bytes to hex string
function bytesToHex(buffer, start, length) {
    let hex = '';
    for (let i = start; i < start + length && i < buffer.length; i++) {
        hex += buffer[i].toString(16).padStart(2, '0') + ' ';
    }
    return hex.trim();
}

// Parse MAVLink ATTITUDE message (simplified)
function parseAttitude(buffer, offset) {
    console.log(`  [DEBUG] Parsing ATTITUDE message at offset ${offset}`);
    
    // MAVLink v1 header is 6 bytes, payload starts after header
    const payloadStart = offset + 6;
    
    // Check if we have enough buffer length
    if (payloadStart + 28 > buffer.length) {
        console.log(`  [ERROR] ATTITUDE: Insufficient buffer length. Need ${payloadStart + 28}, have ${buffer.length}`);
        parseErrors++;
        return null;
    }
    
    try {
        // ATTITUDE message payload:
        // time_boot_ms (0-3): uint32
        // roll (4-7): float
        // pitch (8-11): float
        // yaw (12-15): float
        // rollspeed (16-19): float
        // pitchspeed (20-23): float
        // yawspeed (24-27): float
        
        const roll = buffer.readFloatLE(payloadStart + 4);
        const pitch = buffer.readFloatLE(payloadStart + 8);
        const yaw = buffer.readFloatLE(payloadStart + 12);
        
        const result = {
            roll: roll * 180 / Math.PI,
            pitch: pitch * 180 / Math.PI,
            yaw: yaw * 180 / Math.PI
        };
        
        console.log(`  [SUCCESS] ATTITUDE parsed: roll=${result.roll.toFixed(2)}°, pitch=${result.pitch.toFixed(2)}°, yaw=${result.yaw.toFixed(2)}°`);
        
        return result;
    } catch (error) {
        console.log(`  [ERROR] ATTITUDE parsing failed:`, error.message);
        parseErrors++;
        return null;
    }
}

// Parse MAVLink GLOBAL_POSITION_INT message
function parseGlobalPosition(buffer, offset) {
    console.log(`  [DEBUG] Parsing GLOBAL_POSITION_INT message at offset ${offset}`);
    
    const payloadStart = offset + 6;
    
    // Check if we have enough buffer length
    if (payloadStart + 28 > buffer.length) {
        console.log(`  [ERROR] GLOBAL_POSITION_INT: Insufficient buffer length. Need ${payloadStart + 28}, have ${buffer.length}`);
        parseErrors++;
        return null;
    }
    
    try {
        // GLOBAL_POSITION_INT message payload:
        // time_boot_ms (0-3): uint32
        // lat (4-7): int32
        // lon (8-11): int32
        // alt (12-15): int32
        // relative_alt (16-19): int32
        
        const lat = buffer.readInt32LE(payloadStart + 4) / 1e7;
        const lon = buffer.readInt32LE(payloadStart + 8) / 1e7;
        const alt = buffer.readInt32LE(payloadStart + 12) / 1000; // mm to m
        const relative_alt = buffer.readInt32LE(payloadStart + 16) / 1000;
        
        const result = {
            lat,
            lon,
            alt,
            relative_alt
        };
        
        console.log(`  [SUCCESS] GLOBAL_POSITION_INT parsed: lat=${lat.toFixed(6)}, lon=${lon.toFixed(6)}, alt=${alt.toFixed(2)}m`);
        
        return result;
    } catch (error) {
        console.log(`  [ERROR] GLOBAL_POSITION_INT parsing failed:`, error.message);
        parseErrors++;
        return null;
    }
}

// Listen for MAVLink messages
udpClient.on('message', (msg, rinfo) => {
    messageCount++;
    
    console.log(`\n[UDP MESSAGE #${messageCount}] Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
    console.log(`  First 20 bytes: ${bytesToHex(msg, 0, 20)}`);
    
    let mavlinkFound = false;
    
    // Simple MAVLink parser (v1.0)
    for (let i = 0; i < msg.length - 8; i++) {
        if (msg[i] === 0xFE) { // MAVLink v1.0 start byte
            mavlinkFound = true;
            mavlinkCount++;
            
            console.log(`  [MAVLINK] Found start byte 0xFE at offset ${i}`);
            
            // MAVLink v1 header structure:
            // 0: Start byte (0xFE)
            // 1: Payload length
            // 2: Packet sequence
            // 3: System ID
            // 4: Component ID
            // 5: Message ID
            
            if (i + 6 <= msg.length) {
                const payloadLen = msg[i + 1];
                const sysId = msg[i + 3];
                const compId = msg[i + 4];
                const msgId = msg[i + 5];
                
                console.log(`  [MAVLINK HEADER] PayloadLen=${payloadLen}, SysID=${sysId}, CompID=${compId}, MsgID=${msgId}`);
                console.log(`  Header bytes: ${bytesToHex(msg, i, 6)}`);
                
                let data = null;
                let msgName = 'UNKNOWN';
                
                switch (msgId) {
                    case MAVLINK_MSG_ID_HEARTBEAT:
                        msgName = 'HEARTBEAT';
                        console.log(`  [DETECTED] HEARTBEAT message`);
                        break;
                        
                    case MAVLINK_MSG_ID_ATTITUDE:
                        msgName = 'ATTITUDE';
                        console.log(`  [DETECTED] ATTITUDE message`);
                        const attitude = parseAttitude(msg, i);
                        if (attitude) {
                            data = {
                                type: 'attitude',
                                ...attitude
                            };
                        }
                        break;
                        
                    case MAVLINK_MSG_ID_GLOBAL_POSITION_INT:
                        msgName = 'GLOBAL_POSITION_INT';
                        console.log(`  [DETECTED] GLOBAL_POSITION_INT message`);
                        const position = parseGlobalPosition(msg, i);
                        if (position) {
                            data = {
                                type: 'position',
                                ...position
                            };
                        }
                        break;
                        
                    default:
                        console.log(`  [DETECTED] Message ID ${msgId} (not handled)`);
                }
                
                if (data) {
                    console.log(`  [WEBSOCKET] Sending ${msgName} data to ${clients.size} clients`);
                    
                    // Send to all connected clients
                    let sentCount = 0;
                    clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify(data));
                            sentCount++;
                        }
                    });
                    
                    console.log(`  [WEBSOCKET] Data sent to ${sentCount} active clients`);
                }
            } else {
                console.log(`  [WARNING] Insufficient bytes for MAVLink header at offset ${i}`);
            }
        }
    }
    
    if (!mavlinkFound) {
        console.log(`  [WARNING] No MAVLink start bytes (0xFE) found in this message`);
    }
});

// Error handling
udpClient.on('error', (err) => {
    console.error('[UDP ERROR]', err);
});

// Bind to UDP port
udpClient.bind(MAVLINK_PORT, () => {
    console.log(`[STARTUP] Listening for MAVLink on UDP port ${MAVLINK_PORT}`);
    console.log(`[INFO] Looking for MAVLink v1.0 messages (start byte 0xFE)`);
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`[STARTUP] Server running at http://localhost:${PORT}`);
    console.log(`[STARTUP] Open http://localhost:${PORT}/web-viewer.html in your browser`);
});

// Status logging every 10 seconds
setInterval(() => {
    console.log(`\n[STATUS] Messages: ${messageCount}, MAVLink packets: ${mavlinkCount}, Parse errors: ${parseErrors}`);
}, 10000);