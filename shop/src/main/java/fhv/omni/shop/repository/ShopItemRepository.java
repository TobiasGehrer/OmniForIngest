package fhv.omni.shop.repository;

import fhv.omni.shop.entity.ShopItem;
import fhv.omni.shop.enums.ItemType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShopItemRepository extends JpaRepository<ShopItem, Long> {
    Optional<ShopItem> findByItemId(String itemId);

    List<ShopItem> findByIsActiveTrueOrderByItemTypeAscPriceAsc();

    List<ShopItem> findByItemTypeAndIsActiveTrue(ItemType itemType);
}
