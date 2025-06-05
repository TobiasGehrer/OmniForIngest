package fhv.omni.auth.domain;

import org.springframework.stereotype.Service;

@Service
public class UsernameValidator implements IValidateUsername {
    private final String VALID_CHARACTERS_REGEX = "[a-zA-Z0-9_-]+"; // Allows characters, numbers and the special characters "_" and "-"
    private final int MAX_LENGTH = 24;

    @Override
    public void validateUsername(String username) throws UsernameMalformedException, UsernameLengthException {
        if (username == null || username.isBlank()) {
            throw new UsernameMalformedException("Username is null or blank");
        }

        String usernameLowerCase = username.toLowerCase();

        if (!usernameLowerCase.matches(VALID_CHARACTERS_REGEX)) {
            throw new UsernameMalformedException(String.format("Username %s is invalid", username));
        }

        if (username.length() > MAX_LENGTH) {
            throw new UsernameLengthException("Username is longer than maximum length of " + MAX_LENGTH);
        }
    }
}
