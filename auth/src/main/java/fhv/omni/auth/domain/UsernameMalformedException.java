package fhv.omni.auth.domain;

public class UsernameMalformedException extends Exception {
    public UsernameMalformedException(String message) {
        super(message);
    }
}
