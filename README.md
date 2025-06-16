# ArduPilot SITL 3D Web Viewer

Advanced 3D web-based visualization system for ArduPilot SITL drone telemetry with realistic quadcopter modeling and interactive camera controls.

## Project Components

- **Node.js Server**: Receives MAVLink data and forwards to web clients via WebSocket
- **3D Web Viewer**: Real-time 3D drone visualization with follow camera and flight path tracking

## Prerequisites

- Node.js (v12 or higher)
- ArduPilot SITL

## Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. ArduPilot SITL Setup
```bash
# Install ArduPilot SITL (Ubuntu/WSL)
git clone https://github.com/ArduPilot/ardupilot.git
cd ardupilot
./Tools/environment_install/install-prereqs-ubuntu.sh -y
./waf configure --board sitl
./waf copter
```


## Running the Application

### 1. Start ArduPilot SITL
```bash
# In ardupilot directory
sim_vehicle.py -v ArduCopter --out=udp:127.0.0.1:14551
```

### 2. Start the Server
```bash
npm start
```

### 3. Open Web Viewer
Open `web-viewer.html` in your browser to view the 3D visualization

### 4. Test SITL Commands
In the SITL console:
```
mode guided
arm throttle
takeoff 10
```

## Features

### 3D Visualization
- **Realistic 3DR Iris Model**: Detailed quadcopter with blue arms, black body, and gimbal
- **Live 3D Orientation**: Real-time drone rotation based on attitude data
- **Animated Propellers**: Counter-rotating propellers during flight
- **Flight Path Tracking**: 3D trail visualization with configurable history

### Interactive Camera System
- **Follow Mode**: Toggle button for automatic drone tracking
- **View Angle Preservation**: Maintains current viewing perspective during follow
- **Full Camera Controls**: Orbit, zoom, pan with mouse/touch
- **Smooth Tracking**: Seamless camera movement following drone position

### Real-time Telemetry
- **Attitude Display**: Roll, pitch, yaw with live updates
- **GPS Position**: Relative coordinates from home position
- **Altitude Monitoring**: Real-time altitude display
- **Connection Status**: Visual server connection indicators

### User Interface
- **Japanese Language Support**: Localized interface
- **Interactive Controls**: Mouse operation guide
- **Path Management**: Flight path clearing functionality
- **Responsive Design**: Works on desktop and mobile devices

## Configuration

- **MAVLink Port**: 14551 (UDP)
- **WebSocket Port**: 3000
- **Supported Messages**: HEARTBEAT, ATTITUDE, GLOBAL_POSITION_INT

## Development

```bash
# Debug mode
node server-debug.js
```

## Controls

### Mouse Operations
- **Left Drag**: Rotate camera around drone
- **Right Drag**: Pan camera view
- **Mouse Wheel**: Zoom in/out
- **Follow Mode Button**: Toggle automatic drone tracking

### Follow Mode
1. Click "追従モード: OFF" button to enable
2. Camera automatically tracks drone movement
3. Current viewing angle is preserved
4. Mouse controls remain active for angle adjustment
5. Click again to disable and return to free camera

## Files

- `server.js` - Main server application with MAVLink parsing
- `web-viewer.html` - 3D visualization web interface
- `server-debug.js` - Debug version with enhanced logging
- `package.json` - Node.js dependencies and scripts
- `mav.tlog`, `mav.parm` - MAVLink log and parameter files

## Technology Stack

- **Backend**: Node.js with WebSocket server
- **Frontend**: Three.js for 3D graphics
- **Communication**: MAVLink protocol over UDP/WebSocket
- **3D Graphics**: WebGL with Three.js renderer
- **Camera Controls**: OrbitControls for interactive viewing