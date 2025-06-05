package fhv.omni.auth.domain;

public class UsernameLengthException extends Exception {
    public UsernameLengthException(String message) {
        super(message);
    }
}
