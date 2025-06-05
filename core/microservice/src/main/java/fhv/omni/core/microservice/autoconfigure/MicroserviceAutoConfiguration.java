package fhv.omni.core.microservice.autoconfigure;

import fhv.omni.core.microservice.config.CookieConfig;
import fhv.omni.core.microservice.config.SessionConfig;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.session.data.redis.config.annotation.web.http.EnableRedisHttpSession;

@AutoConfiguration
@EnableRedisHttpSession
@Import({
        SessionConfig.class,
        CookieConfig.class
})
public class MicroserviceAutoConfiguration {
}
