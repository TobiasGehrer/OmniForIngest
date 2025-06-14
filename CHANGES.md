# Changes

##### 2025-01-24 0.25.0

- BUGFIX: Fixed event listener memory leaks when transitioning between scenes. [!37]
- BUGFIX: Fixed "Cannot read properties of undefined" errors when changing skins after returning to menu. [!37]
- BUGFIX: Fixed skin changes not being immediately visible without movement. [!37]
- ENHANCEMENT: Added proper scene activity checks in Player, PlayerManager, and AnimationManager. [!37]
- ENHANCEMENT: Improved skin persistence when transitioning between gameplay and menu scenes. [!37]

##### 2025-06-12 0.24.0

- ENHANCEMENT: SonarQube enhancements throughout the whole project [!39]

##### 2025-06-12 0.24.0

- FEATURE: Add skins to the game. [!36]

##### 2025-06-12 0.23.0

- FEATURE: Enhanced user interface components. [!34]
- FEATURE: Added script to start all microservices on the server. [!34]
- FEATURE: Added dynamic api endpoints depending on the environment. [!34]
- 
##### 2025-06-10 0.22.0

- BUGFIX: Fixed WebSocket connection issues through gateway. [!33]
- ENHANCEMENT: Corrected gateway WebSocket routing configuration. [!33]

##### 2025-06-10 0.21.0

- FEATURE: NPC for map3, who attacks nearby players. [!30]

##### 2025-06-10 0.20.0

- FEATURE: Growing damage zone system for map3. [!29]
- FEATURE: Static damage and healing zones on map3 (transferred from map2). [!29]
- ENHANCEMENT: Smooth particle transition system for damage zone effects. [!29]


##### 2025-06-10 0.19.0

- FEATURE: Growing damage zone system for map3. [!29]
- FEATURE: Static damage and healing zones on map3 (transferred from map2). [!29]
- ENHANCEMENT: Smooth particle transition system for damage zone effects. [!29]

##### 2025-06-09 0.18.0

- FEATURE: Transitioned Gateway from MVC -> Webflux [!28]
- FEATURE: Added security to gameLogic [!28]
- FEATURE: Gateway forwarding to gameLogic websockets and port updates [!28]

##### 2025-06-08 0.17.0

- FEATURE: Shop Microservice with map unlock system. [!27]
- FEATURE: Shop UI for purchasing map access and future items. [!27]
- FEATURE: Integration with Wallet service for secure transactions. [!27]
- FEATURE: Map access control based on player unlocks. [!27]

##### 2025-06-07 0.16.0

- FEATURE: Wallet Microservice. [!26]
- FEATURE: Game awards coins based on rankings. [!26]
- FEATURE: Visual coin display on game scoreboard. [!26]
- BUGFIX: Fixed broken chat [!26]

##### 2025-06-07 0.15.0

- FEATURE: Maps have different game rooms in backend. [!25]
- FEATURE: Game lobby, game loop and ranking. [!25]
- ENHANCEMENT: Websocket connection and closing. [!25]

##### 2025-06-05 0.14.0

- FEATURE: Use username ingame. [!24]
- FEATURE: New loading screen. [!24]
- ENHANCEMENT: Tint player projectiles in player color. [!24]
- ENHANCEMENT: Reformat and cleanup entire frontend code. [!24]
- ENHANCEMENT: Adjusted damage zone tick interval. [!24]
- ENHANCEMENT: Update Readme. [!24]

##### 2025-06-04 0.13.0

- FEATURE: Gateway to check for session and then routing. [!20]
- FEATURE: core:microservice module to auto configure security for microservices. [!20]

##### 2025-05-27 0.12.0

- FEATURE: Refactor movement to use Phaser position for collision detection in multiplayer. [!22]

##### 2025-05-20 0.11.0

- FEATURE: Add ingame text chat. [!18]

##### 2025-05-20 0.10.0

- FEATURE: Added complete map. [!19]
- BUGFIX: Fix world bounds. [!19]

##### 2025-05-18 0.9.0

- FEATURE: Implement toast style notifications. [!17]
- ENHANCEMENT: Add border style to UI elements. [!17]

##### 2025-05-18 0.8.0

- FEATURE: Advanced audio filtering. [!16]

##### 2025-05-18 0.7.0

- FEATURE: Basic combat system. [!14]
- ENHANCEMENT: Changed class naming to BEM convention. [!14]
- BUGFIX: Fixed Escape menu crashing the game in multiplayer. [!14]
- BUGFIX: Fixed healthbar scaling. [!15]

##### 2025-05-16 0.6.0

- FEATURE: Add basic frontend & backend build pipeline. [!13]

##### 2025-05-16 0.5.0

- FEATURE: Refactored most logic into their own manager class. [!12]

##### 2025-05-14 0.4.0

- FEATURE: Implemented multiplayer with websockets. [!9]

##### 2025-05-03 0.3.0

- FEATURE: Implemented username case-insensitivity into register and login process. [!8]

##### 2025-05-02 0.2.0

- FEATURE: Added CORS configuration for Omni-Client [!7]

##### 2025-04-30 0.1.0

- FEATURE: Added Microservice that handles Authentication and Authorization using a decentralized Session Storage [!4]
