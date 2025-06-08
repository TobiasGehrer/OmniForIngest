package fhv.omni.shop.repository;

import fhv.omni.shop.entity.PlayerUnlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlayerUnlockRepository extends JpaRepository<PlayerUnlock, Long> {
    List<PlayerUnlock> findByUsername(String username);

    Optional<PlayerUnlock> findByUsernameAndItemId(String username, String itemId);

    boolean existsByUsernameAndItemId(String username, String itemId);

    @Query("SELECT pu.itemId FROM PlayerUnlock pu where pu.username = :username")
    List<String> findUnlockedItemIdsByUsername(@Param("username") String username);
}
