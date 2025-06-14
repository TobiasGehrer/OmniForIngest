package fhv.omni.wallet.repository;

import fhv.omni.wallet.entity.Wallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, Long> {

    Optional<Wallet> findByUsername(String username);

    @Modifying
    @Query("UPDATE Wallet w SET w.coins = w.coins + :amount WHERE w.username = :username")
    int addCoins(@Param("username") String username, @Param("amount") Integer amount);

    boolean existsByUsername(String username);
}
