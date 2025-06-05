package fhv.omni.core.microservice.auth;

import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;

public class UserDetailsPatcher {
    public static UserDetails get(Authentication authentication) {
        if (!(authentication instanceof UserDetails)) {
            throw new AuthenticationServiceException("Authentication object is not instance of UserDetails");
        } else {
            return (UserDetails) authentication;
        }
    }
}
