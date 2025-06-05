package fhv.omni.gamelogic.service.auth;

import org.springframework.stereotype.Service;

@Service
public class AuthService {

    public String getUserNameByToken(String token) {
        //TODO: authenticateUser via REST
        return token;
    }
}
