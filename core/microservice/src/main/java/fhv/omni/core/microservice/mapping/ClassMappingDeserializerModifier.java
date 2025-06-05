package fhv.omni.core.microservice.mapping;

import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.deser.DeserializationProblemHandler;
import com.fasterxml.jackson.databind.jsontype.TypeIdResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Map;

public class ClassMappingDeserializerModifier extends DeserializationProblemHandler {
    private static final Logger log = LoggerFactory.getLogger(ClassMappingDeserializerModifier.class);

    private final Map<String, Class<?>> classMappings;

    public ClassMappingDeserializerModifier(Map<String, Class<?>> classMappings) {
        this.classMappings = classMappings;
    }

    @Override
    public JavaType handleUnknownTypeId(DeserializationContext ctxt,
                                        JavaType baseType,
                                        String subTypeId,
                                        TypeIdResolver idResolver,
                                        String failureMsg) throws IOException {
        log.debug("Handling unknown type ID: {}", subTypeId);
        Class<?> targetClass = classMappings.get(subTypeId);

        if (targetClass != null) {
            log.info("Mapping class {} to {}", subTypeId, targetClass.getName());
            return ctxt.constructType(targetClass);
        }

        log.warn("No mapping found for class: {}", subTypeId);
        return super.handleUnknownTypeId(ctxt, baseType, subTypeId, idResolver, failureMsg);
    }
}
