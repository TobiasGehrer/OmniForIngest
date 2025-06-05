package fhv.omni.auth.domain;

public class PasswordDoesNotMeetRequirementsException extends Exception {
    public PasswordDoesNotMeetRequirementsException(String message) {
        super(message);
    }
}
