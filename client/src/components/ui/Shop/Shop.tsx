import {useEffect, useState} from "react";
import './Shop.css';

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

const Shop: React.FC<ShopProps> = ({ username, isVisible }) => {
    const [items, setItems] = useState<ShopItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [playerCoins, setPlayerCoins] = useState(0);

    useEffect(() => {
        if (isVisible) {
            fetchShopData();
        }
    }, [isVisible, username]);

    const fetchShopData = async () => {
        setLoading(true);
        try {
            // Fetch shop items
            const itemsResponse = await fetch(`http://localhost:8084/api/shop/items?username=${username}`, {
                credentials: 'include'
            });
            const itemsData = await itemsResponse.json();
            setItems(itemsData);

            // Fetch player coins
            const coinsResponse = await fetch(`http://localhost:8083/api/wallet/${username}/coins`, {
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

            const response = await fetch('http://localhost:8084/api/shop/purchase', {
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
                            ? { ...item, isUnlocked: true }
                            : item
                    )
                );
                setPlayerCoins(result.remainingCoins);
            }
        } catch (error) {
            console.error('Error purchasing item:', error);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="shop-overlay">
            <div className="shop-container">
                <div className="shop-header">
                    <h2>Omni Shop</h2>
                    <div className="shop-coins">{playerCoins} 🪙</div>
                </div>

                {loading ? (
                    <div className="shop-loading">Loading...</div>
                ) : (
                    <div className="shop-items">
                        {items.map((item) => (
                            <div key={item.itemId} className={`shop-item ${item.isUnlocked ? 'unlocked' : ''}`}>
                                <div className="shop-item-info">
                                    <h3>{item.name}</h3>
                                    <p>{item.description}</p>
                                    <div className="shop-item-price">{item.price} 🪙</div>
                                </div>
                                <div className="shop-item-actions">
                                    {item.isUnlocked ? (
                                        <div className="shop-unlocked">Unlocked</div>
                                    ) : (
                                        <button
                                            className="shop-buy-btn"
                                            onClick={() => handlePurchase(item.itemId)}
                                            disabled={playerCoins < item.price}
                                        >
                                            {playerCoins >= item.price ? 'Buy' : 'Not enough coins'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Shop;
