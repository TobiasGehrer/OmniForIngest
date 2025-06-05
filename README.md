# Omni

## Overview
Omni is a multi-module application featuring a Java backend and TypeScript/React frontend. It provides a game platform with authentication, core game logic, and an interactive client interface.

## Requirements
- Java 21
- Node.js 18+
- Docker (for databases)
- Gradle 8.0+

## Installation
```bash
# Clone the repository
git clone https://gitlab.com/omni6961018/Omni.git

# Navigate to the project directory
cd Omni

# Build the backend
./gradlew build

# Setup the client
cd client
npm install
```

## Usage
### Running the Backend
```bash
# Start all backend services
./gradlew bootRun

# Start specific module
cd auth
../gradlew bootRun
```

### Running the Frontend
```bash
# Navigate to the client directory
cd client

# Start the development server
npm run dev
```

### Using Docker Compose
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down
```

## API Reference
The Omni API is organized into several modules:

### Auth Service
* `POST /login` - Authenticate a user
* `POST /register` - Register a new user
* `GET /logout` - Logout current user
* `GET /me` - Get current username

### Game Logic API
* `* /game` - Start websocket connection for the game

## Architecture
Omni follows a modular architecture:

- **auth**: Authentication and user management
- **core**: Shared core functionality and utilities
- **gameLogic**: Game rules and state management
- **client**: Frontend React/TypeScript application

## Testing
Run static code analysis locally with the following command.
The host URL is only valid in the FHV Wi-Fi.
```bash
sonar-scanner \
  -Dsonar.projectKey=Omni \
  -Dsonar.sources=src/main \
  -Dsonar.host.url=http://10.0.40.179:9000 \
  -Dsonar.token=sqp_23ff9776568253a0fff47bf5baf75cd7da74a469
```

## Deployment
### Production Deployment
```bash
# Build for production
./gradlew build
cd client && npm run build
```

## Contributing
Guidelines for contributing to the project.

1. Create your feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add some amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request
5. Add the change to [CHANGES.md](./CHANGES.md) using following template
   ```md
   ##### 2025-03-31 0.1.0

   - FEATURE: Description what changed or was added. (#1)
   - BUGFIX: Description what changed or was added. (#2)
   - ENHANCEMENT: Description what changed or was added. (#3)
    ```

## License
MIT License

Copyright © 2025 Omni Development Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
