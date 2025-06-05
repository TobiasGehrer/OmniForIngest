# Omni Client

This is the frontend for the Omni game.

## Run the client

- **Install dependencies:**

    ```bash
    npm install
    ```

- **Start the Development Server**
    
    ```bash
    npm run dev
    ```

## Technology Stack

The Omni Client is built using the following technologies:

- **React** (v19.0.0): A JavaScript library for building user interfaces.
- **TypeScript** (v5.7.2): Adds type safety when developing JavaScript applications.
- **Phaser** (v3.88.2): A fast, free, and fun open-source framework for creating HTML5 games.
- **Vite** (v6.2.0): A modern frontend tooling setup for faster development.
- **ESLint** (v9.21.0): A tool for identifying and fixing JavaScript code issues.

## Project Structure

The project is organized in the following way:

- `src/`: Contains the main source code for the frontend.
    - `components/`: Reusable React components.
    - `assets/`: Assets like images, audio files, etc., used in the game.
    - `game/`: Contains Phaser configurations and logic for the game.
    - `utils/`: Utility functions or helpers.
- `public/`: Static files served by the app.

## Available Scripts

In the project directory, you can run the following commands:

- **Install dependencies**:
  ```bash
  npm install
  ```

- **Start the development server**:
  ```bash
  npm run dev
  ```
  This will start the development server and open the app in your browser.

- **Build the app for production**:
  ```bash
  npm run build
  ```
  This will create a production-ready build of the application in the `dist` folder.

- **Lint the code**:
  ```bash
  npm run lint
  ```
  Analyze the codebase for issues using ESLint.

## Contributing

Contributions are welcome! To contribute:

1. Create a new branch for your feature, bugfix or enhancement:
   ```bash
   git checkout -b (feature | enhancement | bugfix)/feature-name
   ```
2. Add all your changes:
   ```bash
   git add .
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add feature-name"
   ```
4. Push your new branch:
   ```bash
   git push origin your-branch-name
   ```
5. Submit a pull request for review.
