package fhv.omni.gamelogic.service.game;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
        @JsonSubTypes.Type(value = GameInput.MoveDTO.class, name = "move"),
        @JsonSubTypes.Type(value = GameInput.AttackDTO.class, name="attack")
})
public interface GameInput {

    record MoveDTO(String username, int seq, int vx, int vy, String timestamp) implements GameInput {
    }

    record AttackDTO(String username, int seq, String timestamp) implements GameInput {
        //TODO: Implement Logic
    }

    record JoinGameDTO(String username) implements GameInput {
    }
}
