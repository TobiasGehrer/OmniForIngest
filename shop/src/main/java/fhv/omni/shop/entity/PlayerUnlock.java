package fhv.omni.shop.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "player_unlocks", uniqueConstraints = @UniqueConstraint(columnNames = {"username", "item_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlayerUnlock {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(nullable = false)
    private String username;

    @NotNull
    @Column(name = "item_id", nullable = false)
    private String itemId;

    @Column(name = "unlocked_at", nullable = false)
    private LocalDateTime unlockedAt = LocalDateTime.now();

    public PlayerUnlock(String username, String itemId) {
        this.username = username;
        this.itemId = itemId;
    }

    @PrePersist
    protected void onCreate() {
        unlockedAt = LocalDateTime.now();
    }
}
