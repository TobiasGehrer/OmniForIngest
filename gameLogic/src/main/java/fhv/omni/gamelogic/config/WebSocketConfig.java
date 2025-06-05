package fhv.omni.gamelogic.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import fhv.omni.gamelogic.service.game.GameInput;
import jakarta.websocket.Decoder;
import jakarta.websocket.EncodeException;
import jakarta.websocket.Encoder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.server.standard.ServerEndpointExporter;

import java.io.IOException;
import java.io.Reader;

@Configuration
public class WebSocketConfig {
    @Bean
    public ServerEndpointExporter serverEndpointExporter() {
        return new ServerEndpointExporter();
    }

    public static class GameInputDecoder implements Decoder.TextStream<GameInput> {
        private final ObjectMapper objectMapper;

        public GameInputDecoder() {
            this.objectMapper = new ObjectMapper();
        }

        @Override
        public GameInput decode(Reader reader) throws IOException {
            return objectMapper.readValue(reader, GameInput.class);
        }
    }

    public static class GameInputEncoder implements Encoder.Text<GameInput> {
        private final ObjectMapper objectMapper;

        public GameInputEncoder() {
            this.objectMapper = new ObjectMapper();
        }

        @Override
        public String encode(GameInput gameInput) throws EncodeException {
            try {
                return objectMapper.writeValueAsString(gameInput);
            } catch (IOException e) {
                throw new EncodeException(gameInput, "Error encoding GameInput", e);
            }
        }
    }
}