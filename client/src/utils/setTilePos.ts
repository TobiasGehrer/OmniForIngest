const tileSize = 16;

export default function setTilePos(tile: number) {
    return tile * tileSize + tileSize / 2;
}