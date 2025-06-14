import React, {useEffect, useRef, useState} from 'react';
import eventBus from '../../../utils/eventBus.ts';
import './Shop.css';
import useHoverSound from '../../../hooks/useHoverSound.ts';
import {getShopBaseUrl, getWalletBaseUrl} from '../../../utils/apiBaseUrl';

interface ShopItem {
    itemId: string;
    name: string;
    description: string;
    itemType: string;
    price: number;
    isUnlocked: boolean;
}

interface ShopProps {
    username: string;
    onClose?: () => void;
    isVisible: boolean;
}

const Shop: React.FC<ShopProps> = ({
                                       username,
                                       isVisible
                                   }) => {
    const [items, setItems] = useState<ShopItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [playerCoins, setPlayerCoins] = useState(0);
    const [selectedSkin, setSelectedSkin] = useState<string>('player_0');
    const containerRef = useRef<HTMLDivElement>(null);
    const playHoverSound = useHoverSound();

    const playBuySound = () => {
        try {
            const audio = new Audio('/assets/audio/fx/buy.mp3');
            audio.volume = 0.2;
            audio.play().catch(err => console.warn('Could not play buy sound:', err));
        } catch (error) {
            console.warn('Error creating buy sound:', error);
        }
    };

    useEffect(() => {
        if (isVisible) {
            fetchShopData();
        }
    }, [isVisible, username]);

    useEffect(() => {
        if (!isVisible) return;

        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                eventBus.emit('closeShop');
            }
        }

        function handleEsc(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                event.preventDefault();
                eventBus.emit('closeShop');
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [isVisible]);

    const fetchShopData = async () => {
        setLoading(true);
        try {
            // Fetch shop items
            const itemsResponse = await fetch(`${getShopBaseUrl()}/api/shop/items?username=${username}`, {
                credentials: 'include'
            });
            const itemsData = await itemsResponse.json();
            setItems(itemsData);

            // Fetch player coins
            const coinsResponse = await fetch(`${getWalletBaseUrl()}/api/wallet/${username}/coins`, {
                credentials: 'include'
            });
            const coinsData = await coinsResponse.json();
            // Handle both {coins: number} and direct number responses
            const coins = typeof coinsData === 'object' && coinsData.coins !== undefined
                ? coinsData.coins
                : typeof coinsData === 'number'
                    ? coinsData
                    : 0;
            setPlayerCoins(coins);

            // Fetch player preferences
            const preferencesResponse = await fetch(`${getShopBaseUrl()}/api/shop/preferences/${username}`, {
                credentials: 'include'
            });
            const preferencesData = await preferencesResponse.json();
            setSelectedSkin(preferencesData.selectedSkin);
        } catch (error) {
            console.error('Error fetching shop data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async (itemId: string) => {
        try {
            const requestData = {
                username,
                itemId
            };

            const response = await fetch(`${getShopBaseUrl()}/api/shop/purchase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            if (result.success) {
                // Update local state instead of refetching from server
                setItems(prevItems =>
                    prevItems.map(item =>
                        item.itemId === itemId
                            ? {
                                ...item,
                                isUnlocked: true
                            }
                            : item
                    )
                );
                setPlayerCoins(result.remainingCoins);
            }
        } catch (error) {
            console.error('Error purchasing item:', error);
        }
    };

    const handleSelectSkin = async (skinId: string) => {
        try {
            const requestData = {
                username,
                selectedSkin: skinId
            };

            const response = await fetch(`${getShopBaseUrl()}/api/shop/preferences`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(requestData)
            });

            if (response.ok) {
                const result = await response.json();
                setSelectedSkin(result.selectedSkin);

                // Notify the game that the skin has changed
                eventBus.emit('skinChanged', skinId);

                // Play a sound effect
                try {
                    const audio = new Audio('/assets/audio/fx/skin.mp3');
                    audio.volume = 0.5;
                    audio.play().catch(err => console.warn('Could not play audio:', err));
                } catch (error) {
                    console.warn('Error creating audio:', error);
                }
            }
        } catch (error) {
            console.error('Error selecting skin:', error);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="shop-overlay">
            <div className="shop-container" data-title="Shop" ref={containerRef}>
                <div className="shop-header">
                    <span>Balance:</span>
                    <div className="shop-coins">{playerCoins}</div>
                </div>

                <div className="shop-scroll-container">
                    {loading ? (
                        <div className="shop-loading">Loading...</div>
                    ) : (
                        <>
                            {/* Map unlocks section */}
                            <div className="shop-items map-items">
                                {items.filter(item => item.itemType !== 'CHARACTER_SKIN').map((item) => (
                                    <div key={item.itemId} className={`shop-item ${item.isUnlocked ? 'unlocked' : ''}`}>
                                        <div className="shop-item-info">
                                            <div>
                                                <h3>{item.name}</h3>
                                                <p>{item.description}</p>
                                                <div
                                                    className={`shop-item-price ${!item.isUnlocked && playerCoins < item.price ? 'insufficient-funds' : ''}`}>{item.price}</div>
                                            </div>
                                        </div>
                                        <div className="shop-item-actions">
                                            {item.isUnlocked ? (
                                                <img src="/ui/check.svg" width="24px" height="24px" alt=""/>
                                            ) : (
                                                <button
                                                    className="shop-buy-btn"
                                                    onClick={() => {
                                                        playBuySound();
                                                        handlePurchase(item.itemId);
                                                    }}
                                                    disabled={playerCoins < item.price}
                                                    onMouseEnter={playHoverSound}
                                                >
                                                    Buy
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Player skins section */}
                            <div className="shop-items skin-grid">
                                {items
                                    .filter(item => item.itemType === 'CHARACTER_SKIN')
                                    .sort((a, b) => {
                                        // Extract numeric part from itemId (e.g., "player_10" -> 10)
                                        const aNum = parseInt(a.itemId.split('_')[1]);
                                        const bNum = parseInt(b.itemId.split('_')[1]);
                                        return aNum - bNum; // Sort from low to high
                                    })
                                    .map((item) => (
                                        <div key={item.itemId}
                                             className={`shop-item skin-item ${item.isUnlocked ? 'unlocked' : ''}`}>
                                            <div className="skin-item-content">
                                                <div className="skin-item-top">
                                                    <div className="skin-preview-container">
                                                        <div
                                                            className="skin-preview"
                                                            style={{
                                                                backgroundImage: `url(/assets/sprites/characters/${item.itemId}.png)`
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="skin-item-details">
                                                        <div className="skin-item-header">
                                                            <h3>{item.name}</h3>
                                                            {item.isUnlocked && (
                                                                <img src="/ui/check.svg" width="24px" height="24px"
                                                                     alt="Owned" className="skin-owned-check"/>
                                                            )}
                                                        </div>
                                                        <div
                                                            className={`shop-item-price ${!item.isUnlocked && playerCoins < item.price ? 'insufficient-funds' : ''}`}>{item.price}</div>
                                                    </div>
                                                </div>
                                                <div className="skin-item-actions">
                                                    {item.isUnlocked || item.itemId === 'player_0' ? (
                                                        <button
                                                            className={`shop-select-btn ${selectedSkin === item.itemId ? 'selected' : ''}`}
                                                            onClick={() => handleSelectSkin(item.itemId)}
                                                            onMouseEnter={playHoverSound}
                                                            disabled={selectedSkin === item.itemId}
                                                        >
                                                            {selectedSkin === item.itemId ? 'Selected' : 'Select'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="shop-buy-btn"
                                                            onClick={() => {
                                                                playBuySound();
                                                                handlePurchase(item.itemId);
                                                            }}
                                                            disabled={playerCoins < item.price}
                                                            onMouseEnter={playHoverSound}
                                                        >
                                                            Buy
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Shop;
