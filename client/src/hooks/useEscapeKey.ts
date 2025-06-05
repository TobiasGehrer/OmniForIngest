import {useEffect} from 'react';

const useEscapeKey = (onEscape: () => void) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onEscape();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onEscape]);
};

export default useEscapeKey;
