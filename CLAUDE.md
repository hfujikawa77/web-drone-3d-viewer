# SITL Web Viewer Project

## Project Overview
This project integrates ArduPilot SITL (Software In The Loop) with advanced 3D web-based visualization for real-time drone telemetry monitoring and visualization.

## Key Components

### 1. Node.js Server (server.js)
- Listens for MAVLink messages on UDP port 14551
- Parses ATTITUDE and GLOBAL_POSITION_INT messages
- Forwards data to web clients via WebSocket on port 3000

### 2. 3D Web Viewer (web-viewer.html)
- **3D Drone Model**: Realistic 3DR Iris quadcopter visualization
  - Blue arms with black central body
  - Detailed motors, propellers, and gimbal system
  - Animated propeller rotation during flight
- **Real-time Telemetry Display**: 
  - Attitude (roll, pitch, yaw) with live 3D orientation
  - GPS position with relative coordinates from home
  - Altitude display
- **Interactive Camera Controls**:
  - Orbit controls (rotate, zoom, pan)
  - Follow mode with camera tracking
  - Angle preservation during follow mode
- **Flight Path Visualization**:
  - Real-time 3D flight path tracking
  - Configurable path history (up to 10,000 points)
  - Path clearing functionality
- **Enhanced UI Features**:
  - Japanese language interface
  - Connection status indicators
  - Follow mode toggle button


## MAVLink Configuration
- Port: 14551 (UDP)
- Supported messages:
  - HEARTBEAT (ID: 0)
  - ATTITUDE (ID: 30)
  - GLOBAL_POSITION_INT (ID: 33)

## Development Notes
- MAVLink log files: mav.tlog, mav.tlog.raw
- Parameter file: mav.parm

## Setup
See setup-instructions.md for detailed setup steps.

## Commands
```bash
# Start the server
node server.js

# Debug mode
node server-debug.js
```

## Features

### 3D Visualization
- **Realistic 3DR Iris Model**: Accurate quadcopter representation with blue arms and black body
- **Live Orientation**: Real-time 3D rotation based on MAVLink attitude data
- **Animated Propellers**: Counter-rotating propeller animation during flight
- **Camera Gimbal**: Detailed gimbal system visualization

### Camera System
- **Follow Mode**: Automatic camera tracking of drone with toggle button
- **View Angle Preservation**: Maintains current viewing angle during follow mode
- **Interactive Controls**: Full orbit, zoom, and pan capabilities
- **Smooth Tracking**: Seamless camera movement following drone position

### Flight Monitoring
- **3D Flight Path**: Visual trail showing drone's flight history
- **Real-time Telemetry**: Live attitude, position, and altitude data
- **Home Position**: Relative positioning from takeoff location
- **Connection Status**: Visual indicators for server connection

## TODO
- [ ] Add more MAVLink message types support (GPS_RAW_INT, VFR_HUD, etc.)
- [ ] Implement bidirectional communication for command sending
- [ ] Add terrain/map overlay integration
- [ ] Implement mission planning visualization
- [ ] Add data recording and playback features