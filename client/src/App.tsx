import {useEffect, useState} from 'react'
import './App.css'
import './reset.css'
import './ui/fonts/gameovercre.css'
import './ui/buttons/primary.css'
import Game from './components/game/Game.tsx';
import EscapeMenu from './components/ui/EscapeMenu/EscapeMenu.tsx';
import Login from './components/ui/Login/Login.tsx';
import eventBus from './utils/eventBus.ts';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const logoutListener = () => {
            setIsAuthenticated(false);
        };

        eventBus.on('userLogout', logoutListener);

        return () => {
            eventBus.off('userLogout', logoutListener);
        };
    }, []);

    const handleAuthentication = () => {
        setIsAuthenticated(true);
    };

    return (
        <>
            {isAuthenticated ? (
                <>
                    <EscapeMenu/>
                    <Game/>
                </>
            ) : (
                <Login onAuthSuccess={handleAuthentication}/>
            )}
        </>
    )
}

export default App
