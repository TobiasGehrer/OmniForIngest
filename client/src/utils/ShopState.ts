class ShopState {
    public isShopOpen = false;

    private constructor() {
    }

    private static _instance: ShopState;

    static get instance() {
        if (!ShopState._instance) {
            ShopState._instance = new ShopState();
        }
        return ShopState._instance;
    }
}

export default ShopState;
