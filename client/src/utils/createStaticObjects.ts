export default function createStaticObjects(
    scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    objectLayerName: string
): void {
    const objectLayer = map.getObjectLayer(objectLayerName);

    if (!objectLayer) {
        console.warn(`Object layer "${objectLayerName}" not found.`);
        return;
    }

    objectLayer.objects.forEach((objData) => {
        if (objData.type) {
            let gameObject: Phaser.GameObjects.GameObject;
            const x = objData.x ?? 0;
            const y = objData.y ?? 0;

            switch (objData.type) {
                case 'tree': {
                    const treeType = objData.properties?.find((p: {
                        name: string
                    }) => p.name === 'treeType')?.value || 'tree_1';

                    gameObject = scene.add.sprite(x + (objData.width ?? 0) / 2, y + (objData.height ?? 0), treeType);
                    const sprite = gameObject as Phaser.GameObjects.Sprite;
                    sprite.setOrigin(0.5, 1);
                    sprite.setDepth(sprite.y - 10);
                    break;
                }
                case 'sign': {
                    const size = objData.properties?.find((p: {
                        name: string;
                    }) => p.name === 'size')?.value || 'big';
                    const ground = objData.properties?.find((p: {
                        name: string;
                    }) => p.name === 'ground')?.value || 'light';
                    const variant = objData.properties?.find((p: {
                        name: string;
                    }) => p.name === 'variant')?.value || 'wood';
                    const orientation = objData.properties?.find((p: {
                        name: string;
                    }) => p.name === 'orientation')?.value || 'front';
                    const spriteName = `sign_${size}_${ground}_${variant}_${orientation}`;

                    gameObject = scene.add.sprite(x + (objData.width ?? 0) / 2, y + (objData.height ?? 0), spriteName);
                    const sprite = gameObject as Phaser.GameObjects.Sprite;
                    sprite.setOrigin(0, 1)
                    sprite.setDepth(sprite.y - 10);
                    break;
                }
                case 'lantern': {
                    const isOn = objData.properties?.find((p: {
                        name: string;
                    }) => p.name === 'isOn')?.value;
                    const ground = objData.properties?.find((p: {
                        name: string;
                    }) => p.name === 'ground')?.value || 'light';
                    const spriteName = `lantern_${ground}_${isOn}`;

                    gameObject = scene.add.sprite(x + (objData.width ?? 0) / 2, y + (objData.height ?? 0), spriteName);
                    const sprite = gameObject as Phaser.GameObjects.Sprite;
                    sprite.setOrigin(0.5, 1)
                    sprite.setDepth(sprite.y - 10);
                    break;
                }
                case 'fountain': {
                    gameObject = scene.add.sprite(x + (objData.width ?? 0) / 2, y + (objData.height ?? 0), 'fountain');
                    const sprite = gameObject as Phaser.GameObjects.Sprite;
                    sprite.setOrigin(0.5, 1)
                    sprite.setDepth(sprite.y - 10);
                    break;
                }
                default:
                    console.warn(`Unsupported object type: "${objData.type}"`);
                    return;
            }
        }
    });
}
