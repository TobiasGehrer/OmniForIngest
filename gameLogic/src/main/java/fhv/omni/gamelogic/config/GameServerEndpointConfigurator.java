package fhv.omni.gamelogic.config;

import jakarta.websocket.server.ServerEndpointConfig;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.stereotype.Component;

@Component
public class GameServerEndpointConfigurator extends ServerEndpointConfig.Configurator implements ApplicationContextAware {

    private static volatile BeanFactory context;

    @Override
    public <T> T getEndpointInstance(Class<T> clazz) throws InstantiationException {
        if (context == null) {
            throw new InstantiationException("ApplicationContext not injected");
        }

        try {
            return context.getBean(clazz);
        } catch (BeansException e) {
            throw new InstantiationException("Failed to get bean instance: " + e.getMessage());
        }
    }

    @Override
    public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
        context = applicationContext;
    }
}