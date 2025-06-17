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

// MAVLink system status flags
const MAV_MODE_FLAG_SAFETY_ARMED = 128; // 0x80 - bit 7 of base_mode


// WebSocket connections
const clients = new Set();


 // Print stats every 5 seconds

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected');
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected');
    });
});

// Parse MAVLink ATTITUDE message (simplified)
function parseAttitude(buffer, offset) {
    try {
        // Check MAVLink version
        const isV2 = buffer[offset] === 0xFD;
        const headerLength = isV2 ? 10 : 6;
        const payloadLength = buffer[offset + 1];
        const checksumLength = 2;
        const totalMessageLength = headerLength + payloadLength + checksumLength;
        
        // Check if we have enough buffer length for the complete message
        if (offset + totalMessageLength > buffer.length) {
            console.log(`Attitude: insufficient buffer length. Need ${totalMessageLength}, have ${buffer.length - offset}`);
            return null;
        }
        
        const payloadStart = offset + headerLength;
        
        // ATTITUDE message payload (28 bytes):
        // time_boot_ms (0-3): uint32
        // roll (4-7): float
        // pitch (8-11): float
        // yaw (12-15): float
        // rollspeed (16-19): float
        // pitchspeed (20-23): float
        // yawspeed (24-27): float
        
        // Verify payload length for ATTITUDE
        if (payloadLength < 28) {
            return null;
        }
        
        const time_boot_ms = buffer.readUInt32LE(payloadStart);
        const roll = buffer.readFloatLE(payloadStart + 4);
        const pitch = buffer.readFloatLE(payloadStart + 8);
        const yaw = buffer.readFloatLE(payloadStart + 12);
        
        return {
            roll: roll * 180 / Math.PI,
            pitch: pitch * 180 / Math.PI,
            yaw: yaw * 180 / Math.PI,
            time_boot_ms
        };
    } catch (error) {
        console.error('Error parsing ATTITUDE:', error);
        return null;
    }
}

// Parse MAVLink GLOBAL_POSITION_INT message
function parseGlobalPosition(buffer, offset) {
    try {
        // Check MAVLink version
        const isV2 = buffer[offset] === 0xFD;
        const headerLength = isV2 ? 10 : 6;
        const payloadLength = buffer[offset + 1];
        const checksumLength = 2;
        const totalMessageLength = headerLength + payloadLength + checksumLength;
        
        // Check if we have enough buffer length for the complete message
        if (offset + totalMessageLength > buffer.length) {
            console.log(`GlobalPosition: insufficient buffer length. Need ${totalMessageLength}, have ${buffer.length - offset}`);
            return null;
        }
        
        const payloadStart = offset + headerLength;
        
        // GLOBAL_POSITION_INT message payload (28 bytes):
        // time_boot_ms (0-3): uint32
        // lat (4-7): int32
        // lon (8-11): int32
        // alt (12-15): int32
        // relative_alt (16-19): int32
        // vx (20-21): int16
        // vy (22-23): int16
        // vz (24-25): int16
        // hdg (26-27): uint16
        
        // Verify payload length for GLOBAL_POSITION_INT
        if (payloadLength < 28) {
            return null;
        }
        
        const time_boot_ms = buffer.readUInt32LE(payloadStart);
        const lat = buffer.readInt32LE(payloadStart + 4) / 1e7;
        const lon = buffer.readInt32LE(payloadStart + 8) / 1e7;
        const alt = buffer.readInt32LE(payloadStart + 12) / 1000; // mm to m
        const relative_alt = buffer.readInt32LE(payloadStart + 16) / 1000;
        const vx = buffer.readInt16LE(payloadStart + 20) / 100; // cm/s to m/s
        const vy = buffer.readInt16LE(payloadStart + 22) / 100;
        const vz = buffer.readInt16LE(payloadStart + 24) / 100;
        const hdg = buffer.readUInt16LE(payloadStart + 26) / 100; // cdeg to deg
        
        return {
            lat,
            lon,
            alt,
            relative_alt,
            vx,
            vy,
            vz,
            hdg,
            time_boot_ms
        };
    } catch (error) {
        console.error('Error parsing GLOBAL_POSITION_INT:', error);
        return null;
    }
}

// Parse MAVLink HEARTBEAT message
function parseHeartbeat(buffer, offset) {
    try {
        // Check MAVLink version
        const isV2 = buffer[offset] === 0xFD;
        const headerLength = isV2 ? 10 : 6;
        const payloadLength = buffer[offset + 1];
        const checksumLength = 2;
        const totalMessageLength = headerLength + payloadLength + checksumLength;
        
        // Check if we have enough buffer length for the complete message
        if (offset + totalMessageLength > buffer.length) {
            return null;
        }
        
        const payloadStart = offset + headerLength;
        
        // HEARTBEAT message payload (9 bytes):
        // custom_mode (0-3): uint32
        // type (4): uint8
        // autopilot (5): uint8
        // base_mode (6): uint8
        // system_status (7): uint8
        // mavlink_version (8): uint8
        
        // Verify payload length for HEARTBEAT
        if (payloadLength < 9) {
            return null;
        }
        
        const custom_mode = buffer.readUInt32LE(payloadStart);
        const type = buffer.readUInt8(payloadStart + 4);
        const autopilot = buffer.readUInt8(payloadStart + 5);
        const base_mode = buffer.readUInt8(payloadStart + 6);
        const system_status = buffer.readUInt8(payloadStart + 7);
        const mavlink_version = buffer.readUInt8(payloadStart + 8);
        
        // Check if armed (bit 7 of base_mode)
        const is_armed = (base_mode & MAV_MODE_FLAG_SAFETY_ARMED) !== 0;
        
        
        return {
            is_armed,
            system_status,
            base_mode,
            custom_mode,
            type,
            autopilot,
            mavlink_version
        };
    } catch (error) {
        console.error('Error parsing HEARTBEAT:', error);
        return null;
    }
}

// Listen for MAVLink messages
udpClient.on('message', (msg) => {
    
    // MAVLink parser (v1.0 and v2.0) - properly handle multiple messages in one packet
    let offset = 0;
    
    while (offset < msg.length) {
        // Look for MAVLink magic bytes
        if (offset + 8 > msg.length) break; // Not enough bytes for minimal header
        
        if (msg[offset] === 0xFE || msg[offset] === 0xFD) { // MAVLink v1.0 (0xFE) or v2.0 (0xFD)
            const isV2 = msg[offset] === 0xFD;
            const headerLength = isV2 ? 10 : 6;
            const checksumLength = 2;
            
            // Check if we have enough bytes for the header
            if (offset + headerLength > msg.length) {
                break;
            }
            
            // Extract payload length
            const payloadLength = msg[offset + 1];
            const totalMessageLength = headerLength + payloadLength + checksumLength;
            
            // Check if we have the complete message
            if (offset + totalMessageLength > msg.length) {
                break;
            }
            
            let msgId;
            let sysId;
            let compId;
            
            if (isV2) {
                // MAVLink v2.0 header structure:
                // 0: magic (0xFD)
                // 1: payload length
                // 2: incompat flags
                // 3: compat flags
                // 4: sequence
                // 5: system ID
                // 6: component ID
                // 7-9: message ID (24-bit)
                sysId = msg[offset + 5];
                compId = msg[offset + 6];
                msgId = msg[offset + 7] | (msg[offset + 8] << 8) | (msg[offset + 9] << 16);
            } else {
                // MAVLink v1.0 header structure:
                // 0: magic (0xFE)
                // 1: payload length
                // 2: sequence
                // 3: system ID
                // 4: component ID
                // 5: message ID
                sysId = msg[offset + 3];
                compId = msg[offset + 4];
                msgId = msg[offset + 5];
            }
            
            
            let data = null;
            
            switch (msgId) {
                case MAVLINK_MSG_ID_HEARTBEAT:
                    const heartbeat = parseHeartbeat(msg, offset);
                    if (heartbeat && heartbeat.autopilot === 3 && heartbeat.type === 2) {
                        data = {
                            type: 'heartbeat',
                            is_armed: heartbeat.is_armed,
                            system_status: heartbeat.system_status,
                            base_mode: heartbeat.base_mode,
                            custom_mode: heartbeat.custom_mode,
                            autopilot: heartbeat.autopilot,
                            mavlink_version: heartbeat.mavlink_version
                        };
                    }
                    break;
                    
                case MAVLINK_MSG_ID_ATTITUDE:
                    const attitude = parseAttitude(msg, offset);
                    if (attitude) {
                        data = {
                            type: 'attitude',
                            ...attitude
                        };
                    }
                    break;
                    
                case MAVLINK_MSG_ID_GLOBAL_POSITION_INT:
                    const position = parseGlobalPosition(msg, offset);
                    if (position) {
                        data = {
                            type: 'position',
                            ...position
                        };
                    }
                    break;
                    
                default:
                    break;
            }
            
            if (data) {
                // Send to all connected clients
                clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            }
            
            // Move to the next message
            offset += totalMessageLength;
        } else {
            // Not a MAVLink message, skip this byte
            offset++;
        }
    }
});

// Handle UDP errors
udpClient.on('error', (err) => {
    console.error('UDP socket error:', err);
    udpClient.close();
});

// Bind to UDP port
udpClient.bind(MAVLINK_PORT, () => {
    console.log(`\n========================================`);
    console.log(`MAVLink Debug Server Started`);
    console.log(`========================================`);
    console.log(`Listening for MAVLink on UDP port ${MAVLINK_PORT}`);
    console.log(`Expecting MAVLink v1.0 (0xFE) or v2.0 (0xFD) messages`);
    console.log(`\nWaiting for MAVLink messages...`);
    console.log(`(Message statistics will be displayed every 5 seconds)\n`);
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Web server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/web-viewer.html in your browser`);
    console.log(`========================================\n`);
});