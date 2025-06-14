package fhv.omni.gamelogic.config;

import jakarta.websocket.server.HandshakeRequest;
import jakarta.websocket.server.ServerEndpointConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicReference;

@Component
public class GameServerEndpointConfigurator extends ServerEndpointConfig.Configurator implements ApplicationContextAware {

    private static final Logger logger = LoggerFactory.getLogger(GameServerEndpointConfigurator.class);
    private static final AtomicReference<BeanFactory> context = new AtomicReference<>();

    @Override
    public <T> T getEndpointInstance(Class<T> clazz) throws InstantiationException {
        BeanFactory beanFactory = context.get();
        if (beanFactory == null) {
            throw new InstantiationException("ApplicationContext not injected");
        }

        try {
            return beanFactory.getBean(clazz);
        } catch (BeansException e) {
            throw new InstantiationException("Failed to get bean instance: " + e.getMessage());
        }
    }

    @Override
    public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
        context.set(applicationContext);
        logger.debug("Application injected into GameServerEndpointConfigurator");
    }

    @Override
    public void modifyHandshake(ServerEndpointConfig sec, HandshakeRequest request, jakarta.websocket.HandshakeResponse response) {
        super.modifyHandshake(sec, request, response);

        // Set session timeout to 5 minutes
        sec.getUserProperties().put("javax.websocket.server.sessionTimeout", 300000L);
        sec.getUserProperties().put("org.apache.tomcat.websocket.sessionTimeout", 300000L);
        sec.getUserProperties().put("org.apache.tomcat.websocket.BLOCKING_SEND_TIMEOUT", 30000L);

        logger.debug("WebSocket handshake completed for endpoint: {} with extended timeout", sec.getPath());
    }
}
