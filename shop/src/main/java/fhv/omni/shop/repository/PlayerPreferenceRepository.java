package fhv.omni.shop.repository;

import fhv.omni.shop.entity.PlayerPreference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PlayerPreferenceRepository extends JpaRepository<PlayerPreference, Long> {
    Optional<PlayerPreference> findByUsername(String username);

    boolean existsByUsername(String username);
}
