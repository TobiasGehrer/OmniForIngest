package fhv.omni.core.microservice.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.fasterxml.jackson.databind.jsontype.PolymorphicTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import fhv.omni.core.microservice.auth.model.OmniUser;
import fhv.omni.core.microservice.config.jackson.SimpleGrantedAuthorityMixin;
import fhv.omni.core.microservice.mapping.ClassMappingDeserializerModifier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.jackson2.SecurityJackson2Modules;
import org.springframework.session.web.http.CookieHttpSessionIdResolver;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.HttpSessionIdResolver;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class SessionConfig {
    @Bean
    public RedisConnectionFactory redisConnectionFactory() {
        return new LettuceConnectionFactory();
    }

    @Bean
    public HttpSessionIdResolver httpSessionIdResolver(@Autowired CookieSerializer cookieSerializer) {
        CookieHttpSessionIdResolver resolver = new CookieHttpSessionIdResolver();
        resolver.setCookieSerializer(cookieSerializer);
        return resolver;
    }

    @Bean
    public RedisSerializer<Object> springSessionDefaultRedisSerializer() {
        ObjectMapper objectMapper = new ObjectMapper();

        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.registerModules(SecurityJackson2Modules.getModules(getClass().getClassLoader()));
        objectMapper.addMixIn(SimpleGrantedAuthority.class, SimpleGrantedAuthorityMixin.class);

        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        objectMapper.configure(JsonGenerator.Feature.IGNORE_UNKNOWN, true);
        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        PolymorphicTypeValidator ptv = BasicPolymorphicTypeValidator.builder()
                .allowIfBaseType(Object.class)
                .build();

        objectMapper.activateDefaultTyping(
                ptv,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY
        );

        Map<String, Class<?>> classMappings = new HashMap<>();
        classMappings.put("fhv.omni.auth.entity.OmniUser", OmniUser.class);

        objectMapper.addHandler(new ClassMappingDeserializerModifier(classMappings));

        return new GenericJackson2JsonRedisSerializer(objectMapper);
    }
}
