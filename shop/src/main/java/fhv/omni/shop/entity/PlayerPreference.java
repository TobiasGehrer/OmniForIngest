package fhv.omni.shop.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "player_preferences")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlayerPreference {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(unique = true, nullable = false)
    private String username;

    @Column(name = "selected_skin", nullable = false)
    private String selectedSkin = "player_0"; // Default skin

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    public PlayerPreference(String username) {
        this.username = username;
    }

    public PlayerPreference(String username, String selectedSkin) {
        this.username = username;
        this.selectedSkin = selectedSkin;
    }

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
