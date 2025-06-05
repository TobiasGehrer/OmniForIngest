package fhv.omni.auth.domain;

public interface IValidateUsername {
    void validateUsername(String username) throws UsernameMalformedException, UsernameLengthException;
}
