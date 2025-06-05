package fhv.omni.auth.domain;

public interface IValidatePassword {
    void isValidPassword(String password) throws PasswordDoesNotMeetRequirementsException; // Throws exception to allow more specific instructions to the end user
}
